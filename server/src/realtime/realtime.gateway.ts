import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';
import { Utterance } from '../entities/utterance.entity';
import { PresenceEvent } from '../entities/presence-event.entity';
import { Meeting } from '../entities/meeting.entity';
import { MeetingsService } from '../meetings/meetings.service';
import { AgendasService } from '../agendas/agendas.service';
import { DecisionsService } from '../decisions/decisions.service';
import { ActionItemsService } from '../action-items/action-items.service';
import { MeetingStateService } from './meeting-state.service';

interface JoinPayload {
  meeting_id: number;
}
interface UtterancePayload {
  meeting_id: number;
  text: string;
  char_count: number;
  started_at_offset_ms: number;
  ended_at_offset_ms: number;
  confidence?: number | null;
}
interface AgendaStatusPayload {
  meeting_id: number;
  agenda_id: number;
  status?: 'pending' | 'active' | 'done';
  activate?: boolean;
}
interface DecisionPayload {
  meeting_id: number;
  content: string;
  agenda_id?: number;
}
interface ActionPayload {
  meeting_id: number;
  team_id: number;
  description: string;
  assignee_id?: number;
  due_date?: string;
  difficulty?: number;
  agenda_id?: number;
}

// socket.data 는 기본 any 이므로 명시적 타입을 부여한다.
interface SocketData {
  userId?: number;
  meetingId?: number;
}
function dataOf(client: Socket): SocketData {
  return client.data as SocketData;
}

function room(meetingId: number): string {
  return `meeting:${meetingId}`;
}

@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
    private meetingsService: MeetingsService,
    private agendasService: AgendasService,
    private decisionsService: DecisionsService,
    private actionItemsService: ActionItemsService,
    private state: MeetingStateService,
    @InjectRepository(Utterance)
    private utteranceRepo: Repository<Utterance>,
    @InjectRepository(PresenceEvent)
    private presenceRepo: Repository<PresenceEvent>,
    @InjectRepository(Meeting)
    private meetingRepo: Repository<Meeting>,
  ) {}

  // --- 연결 인증 (JWT) ---
  handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        (client.handshake.query?.token as string | undefined);
      if (!token) throw new Error('no token');
      const payload = this.jwtService.verify<{ sub: number; type?: string }>(
        token,
        { secret: this.config.get<string>('JWT_SECRET') },
      );
      if (payload.type === 'refresh') throw new Error('refresh token');
      dataOf(client).userId = payload.sub;
    } catch {
      this.logger.warn(`인증 실패 소켓 연결 차단: ${client.id}`);
      client.emit('error', { message: '인증에 실패했습니다.' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const { meetingId, userId } = dataOf(client);
    if (meetingId && userId) {
      void this.recordPresence(meetingId, userId, 'disconnect', 'involuntary');
    }
  }

  private userId(client: Socket): number {
    return dataOf(client).userId as number;
  }

  // --- 회의 룸 입장 ---
  @SubscribeMessage('meeting:join')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: JoinPayload,
  ) {
    const userId = this.userId(client);
    const meeting = await this.meetingsService.assertParticipant(
      userId,
      body.meeting_id,
    );
    await client.join(room(body.meeting_id));
    dataOf(client).meetingId = body.meeting_id;
    this.state.ensureParticipant(body.meeting_id, userId);
    await this.recordPresence(body.meeting_id, userId, 'join');

    // 시각 동기화 기준점 전달
    client.emit('meeting:t0', {
      meeting_id: meeting.id,
      t0_timestamp: meeting.t0_timestamp,
      status: meeting.status,
    });
    // 입장 알림 + 현재 기여도 스냅샷
    this.server.to(room(body.meeting_id)).emit('presence:update', {
      meeting_id: body.meeting_id,
      user_id: userId,
      event: 'join',
    });
    this.broadcastContribution(body.meeting_id);
    return { ok: true };
  }

  @SubscribeMessage('meeting:leave')
  async onLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: JoinPayload,
  ) {
    const userId = this.userId(client);
    await client.leave(room(body.meeting_id));
    await this.recordPresence(body.meeting_id, userId, 'leave', 'voluntary');
    this.server.to(room(body.meeting_id)).emit('presence:update', {
      meeting_id: body.meeting_id,
      user_id: userId,
      event: 'leave',
    });
    return { ok: true };
  }

  // --- 확정 발화 수신 ---
  @SubscribeMessage('utterance:new')
  async onUtterance(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: UtterancePayload,
  ) {
    const userId = this.userId(client);
    await this.meetingsService.assertParticipant(userId, body.meeting_id);

    // ★ 발화 시점 진행 중 안건에 자동 매칭
    const agendaId = await this.agendasService.getActiveAgendaId(
      body.meeting_id,
    );
    const charCount = body.char_count ?? body.text.length;

    // 발화 원본은 즉시 RDS 저장 (텍스트만, 음성 미저장)
    const saved = await this.utteranceRepo.save(
      this.utteranceRepo.create({
        meeting_id: body.meeting_id,
        user_id: userId,
        text: body.text,
        char_count: charCount,
        confidence: body.confidence ?? null,
        started_at_offset_ms: body.started_at_offset_ms,
        ended_at_offset_ms: body.ended_at_offset_ms,
        agenda_id: agendaId,
      }),
    );

    // 인메모리 누적 + 1초 디바운스 broadcast
    this.state.addChars(body.meeting_id, userId, charCount);
    this.state.scheduleBroadcast(body.meeting_id, () =>
      this.broadcastContribution(body.meeting_id),
    );

    return { utterance_id: saved.id, agenda_id: agendaId };
  }

  // --- 안건 상태 변경 (양방향) ---
  @SubscribeMessage('agenda:status-change')
  async onAgendaStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: AgendaStatusPayload,
  ) {
    const userId = this.userId(client);
    const agenda = body.activate
      ? await this.agendasService.activate(userId, body.agenda_id)
      : await this.agendasService.setStatus(
          userId,
          body.agenda_id,
          body.status ?? 'active',
        );
    this.server
      .to(room(body.meeting_id))
      .emit('agenda:status-change', { meeting_id: body.meeting_id, agenda });

    // 안건이 완료되면 LLM 요약을 비동기로 산출해 broadcast
    if (agenda.status === 'done') {
      void this.summarizeAndBroadcast(userId, body.meeting_id, agenda.id);
    }
    return { ok: true, agenda };
  }

  private async summarizeAndBroadcast(
    userId: number,
    meetingId: number,
    agendaId: number,
  ) {
    try {
      const { summary } = await this.agendasService.summarize(userId, agendaId);
      if (summary) {
        this.server
          .to(room(meetingId))
          .emit('agenda:summary', { agenda_id: agendaId, summary });
      }
    } catch (e) {
      this.logger.error('안건 요약 실패', e as Error);
    }
  }

  // --- 결정·액션 빠른 입력 (양방향) ---
  @SubscribeMessage('decision:new')
  async onDecision(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: DecisionPayload,
  ) {
    const userId = this.userId(client);
    const agendaId =
      body.agenda_id ??
      (await this.agendasService.getActiveAgendaId(body.meeting_id)) ??
      undefined;
    const decision = await this.decisionsService.create(userId, {
      meeting_id: body.meeting_id,
      content: body.content,
      agenda_id: agendaId,
    });
    this.server
      .to(room(body.meeting_id))
      .emit('decision:new', { meeting_id: body.meeting_id, decision });
    return { ok: true, decision };
  }

  @SubscribeMessage('action:new')
  async onAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ActionPayload,
  ) {
    const userId = this.userId(client);
    const agendaId =
      body.agenda_id ??
      (await this.agendasService.getActiveAgendaId(body.meeting_id)) ??
      undefined;
    const action = await this.actionItemsService.create(userId, {
      team_id: body.team_id,
      description: body.description,
      assignee_id: body.assignee_id,
      due_date: body.due_date,
      difficulty: body.difficulty,
      agenda_id: agendaId,
    });
    this.server
      .to(room(body.meeting_id))
      .emit('action:new', { meeting_id: body.meeting_id, action });
    return { ok: true, action };
  }

  // --- 발화 중 표시 (양방향 relay) ---
  @SubscribeMessage('user:speaking-start')
  onSpeakingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: JoinPayload,
  ) {
    this.server.to(room(body.meeting_id)).emit('user:speaking-start', {
      meeting_id: body.meeting_id,
      user_id: this.userId(client),
    });
  }

  @SubscribeMessage('user:speaking-end')
  onSpeakingEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: JoinPayload,
  ) {
    this.server.to(room(body.meeting_id)).emit('user:speaking-end', {
      meeting_id: body.meeting_id,
      user_id: this.userId(client),
    });
  }

  // --- 내부 헬퍼 ---
  private broadcastContribution(meetingId: number) {
    this.server.to(room(meetingId)).emit('contribution:update', {
      meeting_id: meetingId,
      scores: this.state.snapshot(meetingId),
    });
  }

  private async recordPresence(
    meetingId: number,
    userId: number,
    eventType: 'join' | 'leave' | 'disconnect' | 'reconnect',
    classification?: 'voluntary' | 'involuntary',
  ) {
    const meeting = await this.meetingRepo.findOne({
      where: { id: meetingId },
    });
    const offset = meeting?.t0_timestamp
      ? Date.now() - meeting.t0_timestamp.getTime()
      : 0;
    await this.presenceRepo.save(
      this.presenceRepo.create({
        meeting_id: meetingId,
        user_id: userId,
        event_type: eventType,
        disconnect_classification: classification ?? null,
        timestamp_offset_ms: offset,
        reason:
          eventType === 'disconnect'
            ? 'network'
            : eventType === 'leave'
              ? 'user_action'
              : null,
      }),
    );
  }
}
