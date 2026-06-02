import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Meeting } from '../entities/meeting.entity';
import { Agenda } from '../entities/agenda.entity';
import { Utterance } from '../entities/utterance.entity';
import { TeamMembership } from '../entities/team-membership.entity';
import { TeamsService } from '../teams/teams.service';
import { ContributionsService } from '../contributions/contributions.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';

// 회의록 그루핑: 5초 이내 연속 발화는 하나로 묶음 (docs/02·09)
const GROUPING_GAP_MS = 5000;
// 짧은 발화 들여쓰기 기준
const SHORT_UTTERANCE_CHARS = 10;

@Injectable()
export class MeetingsService {
  constructor(
    @InjectRepository(Meeting)
    private meetingRepo: Repository<Meeting>,
    @InjectRepository(Agenda)
    private agendaRepo: Repository<Agenda>,
    @InjectRepository(Utterance)
    private utteranceRepo: Repository<Utterance>,
    @InjectRepository(TeamMembership)
    private membershipRepo: Repository<TeamMembership>,
    private teamsService: TeamsService,
    private contributionsService: ContributionsService,
  ) {}

  async create(userId: number, dto: CreateMeetingDto) {
    await this.teamsService.requireMembership(userId, dto.team_id);
    const meeting = this.meetingRepo.create({
      team_id: dto.team_id,
      scheduled_at: new Date(dto.scheduled_at),
      total_minutes: dto.total_minutes,
      topic: dto.topic ?? null,
      meeting_type: dto.meeting_type ?? 'regular',
      status: 'scheduled',
    });
    return this.meetingRepo.save(meeting);
  }

  async list(userId: number, teamId?: number) {
    let teamIds: number[];
    if (teamId) {
      await this.teamsService.requireMembership(userId, teamId);
      teamIds = [teamId];
    } else {
      const memberships = await this.membershipRepo.find({
        where: { user_id: userId },
      });
      teamIds = memberships.map((m) => m.team_id);
    }
    if (teamIds.length === 0) return [];
    return this.meetingRepo.find({
      where: { team_id: In(teamIds) },
      order: { scheduled_at: 'DESC' },
    });
  }

  async get(userId: number, id: number) {
    const meeting = await this.requireMeeting(id);
    await this.teamsService.requireMembership(userId, meeting.team_id);
    return meeting;
  }

  async update(userId: number, id: number, dto: UpdateMeetingDto) {
    const meeting = await this.requireMeeting(id);
    await this.teamsService.requireMembership(userId, meeting.team_id);

    if (dto.scheduled_at !== undefined)
      meeting.scheduled_at = new Date(dto.scheduled_at);
    if (dto.total_minutes !== undefined)
      meeting.total_minutes = dto.total_minutes;
    if (dto.topic !== undefined) meeting.topic = dto.topic;

    // 무효 처리는 팀장만
    if (dto.is_invalidated !== undefined) {
      await this.teamsService.requireLeader(userId, meeting.team_id);
      meeting.is_invalidated = dto.is_invalidated;
    }
    return this.meetingRepo.save(meeting);
  }

  async remove(userId: number, id: number) {
    const meeting = await this.requireMeeting(id);
    await this.teamsService.requireLeader(userId, meeting.team_id);
    await this.meetingRepo.remove(meeting);
    return { deleted: true };
  }

  // T0 발행 — 시각 동기화 기준점
  async start(userId: number, id: number) {
    const meeting = await this.requireMeeting(id);
    await this.teamsService.requireMembership(userId, meeting.team_id);
    if (meeting.status === 'ended') {
      throw new BadRequestException('이미 종료된 회의입니다.');
    }
    if (!meeting.t0_timestamp) {
      meeting.t0_timestamp = new Date();
    }
    meeting.status = 'active';
    await this.meetingRepo.save(meeting);
    return {
      meeting_id: meeting.id,
      t0_timestamp: meeting.t0_timestamp,
      status: meeting.status,
    };
  }

  // 회의 종료 — 안건 마감 처리 + 기여도(트랙1) 산정·저장 트리거
  async end(userId: number, id: number) {
    const meeting = await this.requireMeeting(id);
    await this.teamsService.requireMembership(userId, meeting.team_id);
    if (meeting.status === 'ended') {
      throw new BadRequestException('이미 종료된 회의입니다.');
    }

    const endedAt = new Date();
    meeting.ended_at = endedAt;
    meeting.status = 'ended';
    await this.meetingRepo.save(meeting);

    await this.finalizeAgendas(meeting.id, endedAt, meeting.t0_timestamp);

    // 외부 기여도 서버에 트랙1 계산 요청 → contribution_scores 저장
    const scores = await this.contributionsService.computeAndStoreMeetingScores(
      meeting.id,
    );

    return {
      meeting_id: meeting.id,
      ended_at: endedAt,
      contribution_scores: scores,
    };
  }

  // 진행 중이던 안건을 완료 처리하고 actual_minutes 보정
  private async finalizeAgendas(
    meetingId: number,
    endedAt: Date,
    t0: Date | null,
  ) {
    const agendas = await this.agendaRepo.find({
      where: { meeting_id: meetingId },
    });
    const endOffset = t0 ? endedAt.getTime() - t0.getTime() : null;
    for (const a of agendas) {
      if (a.status === 'active') {
        if (endOffset !== null && a.ended_at_offset_ms === null) {
          a.ended_at_offset_ms = endOffset;
        }
        a.status = 'done';
      }
      if (
        a.started_at_offset_ms !== null &&
        a.ended_at_offset_ms !== null &&
        a.actual_minutes === null
      ) {
        a.actual_minutes = Math.round(
          (a.ended_at_offset_ms - a.started_at_offset_ms) / 60000,
        );
      }
    }
    if (agendas.length > 0) await this.agendaRepo.save(agendas);
  }

  // 회의록 그루핑 (시간순 → 5초 이내 연속 발화 병합 → 안건별 분류)
  async getTranscript(userId: number, id: number) {
    const meeting = await this.get(userId, id);
    const utterances = await this.utteranceRepo.find({
      where: { meeting_id: meeting.id },
      order: { started_at_offset_ms: 'ASC' },
    });

    type Group = {
      user_id: number;
      agenda_id: number | null;
      text: string;
      started_at_offset_ms: number;
      ended_at_offset_ms: number;
      is_short: boolean;
    };
    const groups: Group[] = [];
    for (const u of utterances) {
      const prev = groups[groups.length - 1];
      const mergeable =
        prev &&
        prev.user_id === u.user_id &&
        prev.agenda_id === u.agenda_id &&
        u.started_at_offset_ms - prev.ended_at_offset_ms <= GROUPING_GAP_MS;
      if (mergeable) {
        prev.text += ' ' + u.text;
        prev.ended_at_offset_ms = u.ended_at_offset_ms;
        prev.is_short = prev.text.length < SHORT_UTTERANCE_CHARS;
      } else {
        groups.push({
          user_id: u.user_id,
          agenda_id: u.agenda_id,
          text: u.text,
          started_at_offset_ms: u.started_at_offset_ms,
          ended_at_offset_ms: u.ended_at_offset_ms,
          is_short: u.text.length < SHORT_UTTERANCE_CHARS,
        });
      }
    }

    // 안건별 분류
    const agendas = await this.agendaRepo.find({
      where: { meeting_id: meeting.id },
      order: { order_index: 'ASC' },
    });
    const byAgenda = new Map<number | 'none', Group[]>();
    for (const g of groups) {
      const key = g.agenda_id ?? 'none';
      if (!byAgenda.has(key)) byAgenda.set(key, []);
      byAgenda.get(key)!.push(g);
    }

    const sections = agendas.map((a) => ({
      agenda_id: a.id,
      title: a.title,
      status: a.status,
      summary: a.summary,
      groups: byAgenda.get(a.id) ?? [],
    }));
    const unassigned = byAgenda.get('none') ?? [];
    if (unassigned.length > 0) {
      sections.push({
        agenda_id: 0,
        title: '미분류',
        status: 'done',
        summary: null,
        groups: unassigned,
      });
    }
    return { meeting_id: meeting.id, sections };
  }

  private async requireMeeting(id: number) {
    const meeting = await this.meetingRepo.findOne({ where: { id } });
    if (!meeting) throw new NotFoundException('회의를 찾을 수 없습니다.');
    return meeting;
  }

  // 다른 모듈(게이트웨이 등)에서 회의 접근 권한 확인용
  async assertParticipant(userId: number, meetingId: number) {
    const meeting = await this.requireMeeting(meetingId);
    const m = await this.membershipRepo.findOne({
      where: { team_id: meeting.team_id, user_id: userId },
    });
    if (!m) throw new ForbiddenException('회의 참가 권한이 없습니다.');
    return meeting;
  }
}
