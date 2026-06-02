import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agenda, AgendaStatus } from '../entities/agenda.entity';
import { Meeting } from '../entities/meeting.entity';
import { Utterance } from '../entities/utterance.entity';
import { TeamsService } from '../teams/teams.service';
import { LlmService } from '../llm/llm.service';
import { CreateAgendaDto } from './dto/create-agenda.dto';
import { UpdateAgendaDto } from './dto/update-agenda.dto';

@Injectable()
export class AgendasService {
  constructor(
    @InjectRepository(Agenda)
    private agendaRepo: Repository<Agenda>,
    @InjectRepository(Meeting)
    private meetingRepo: Repository<Meeting>,
    @InjectRepository(Utterance)
    private utteranceRepo: Repository<Utterance>,
    private teamsService: TeamsService,
    private llmService: LlmService,
  ) {}

  async listForMeeting(userId: number, meetingId: number) {
    await this.requireMeetingAccess(userId, meetingId);
    return this.agendaRepo.find({
      where: { meeting_id: meetingId },
      order: { order_index: 'ASC' },
    });
  }

  async create(userId: number, meetingId: number, dto: CreateAgendaDto) {
    const meeting = await this.requireMeetingAccess(userId, meetingId);
    const max = await this.agendaRepo
      .createQueryBuilder('a')
      .select('MAX(a.order_index)', 'max')
      .where('a.meeting_id = :meetingId', { meetingId })
      .getRawOne<{ max: number | null }>();
    const agenda = this.agendaRepo.create({
      meeting_id: meetingId,
      title: dto.title,
      estimated_minutes: dto.estimated_minutes ?? 0,
      order_index: (max?.max ?? -1) + 1,
      milestone_id: dto.milestone_id ?? null,
      // 회의 진행 중 추가는 즉석(ad_hoc), 그 외는 manual 기본
      source: dto.source ?? (meeting.status === 'active' ? 'ad_hoc' : 'manual'),
      status: 'pending',
    });
    return this.agendaRepo.save(agenda);
  }

  async update(userId: number, agendaId: number, dto: UpdateAgendaDto) {
    const { agenda } = await this.requireAgendaAccess(userId, agendaId);
    if (dto.title !== undefined) agenda.title = dto.title;
    if (dto.estimated_minutes !== undefined)
      agenda.estimated_minutes = dto.estimated_minutes;
    if (dto.order_index !== undefined) agenda.order_index = dto.order_index;
    if (dto.milestone_id !== undefined) agenda.milestone_id = dto.milestone_id;
    if (dto.status !== undefined) {
      return this.setStatus(userId, agendaId, dto.status);
    }
    return this.agendaRepo.save(agenda);
  }

  async remove(userId: number, agendaId: number) {
    const { agenda } = await this.requireAgendaAccess(userId, agendaId);
    await this.agendaRepo.remove(agenda);
    return { deleted: true };
  }

  // 안건 활성화 — 같은 회의의 다른 active 안건은 자동 완료(단일 진행 모델)
  async activate(userId: number, agendaId: number) {
    const { agenda, meeting } = await this.requireAgendaAccess(
      userId,
      agendaId,
    );
    const offset = this.offsetNow(meeting);

    const others = await this.agendaRepo.find({
      where: { meeting_id: agenda.meeting_id, status: 'active' },
    });
    for (const o of others) {
      if (o.id === agenda.id) continue;
      o.status = 'done';
      if (o.ended_at_offset_ms === null && offset !== null)
        o.ended_at_offset_ms = offset;
      this.fillActualMinutes(o);
    }
    if (others.length > 0) await this.agendaRepo.save(others);

    agenda.status = 'active';
    if (agenda.started_at_offset_ms === null && offset !== null)
      agenda.started_at_offset_ms = offset;
    return this.agendaRepo.save(agenda);
  }

  async setStatus(userId: number, agendaId: number, status: AgendaStatus) {
    const { agenda, meeting } = await this.requireAgendaAccess(
      userId,
      agendaId,
    );
    const offset = this.offsetNow(meeting);
    if (status === 'active' && agenda.started_at_offset_ms === null) {
      if (offset !== null) agenda.started_at_offset_ms = offset;
    }
    if (status === 'done') {
      if (agenda.ended_at_offset_ms === null && offset !== null)
        agenda.ended_at_offset_ms = offset;
      this.fillActualMinutes(agenda);
    }
    agenda.status = status;
    return this.agendaRepo.save(agenda);
  }

  // 안건 LLM 요약 (완료 시). 발화를 모아 GPT-4o-mini 호출 후 저장.
  async summarize(userId: number, agendaId: number) {
    const { agenda } = await this.requireAgendaAccess(userId, agendaId);
    if (agenda.status !== 'done') {
      throw new BadRequestException('완료된 안건만 요약할 수 있습니다.');
    }
    const utterances = await this.utteranceRepo.find({
      where: { agenda_id: agendaId },
      order: { started_at_offset_ms: 'ASC' },
    });
    const summary = await this.llmService.summarizeAgenda(
      agenda.title,
      utterances.map((u) => u.text),
    );
    agenda.summary = summary;
    await this.agendaRepo.save(agenda);
    return { agenda_id: agendaId, summary };
  }

  // 게이트웨이가 발화 태깅에 사용 — 현재 진행 중 안건
  async getActiveAgendaId(meetingId: number): Promise<number | null> {
    const active = await this.agendaRepo.findOne({
      where: { meeting_id: meetingId, status: 'active' },
      order: { started_at_offset_ms: 'DESC' },
    });
    return active?.id ?? null;
  }

  private fillActualMinutes(a: Agenda) {
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

  private offsetNow(meeting: Meeting): number | null {
    if (!meeting.t0_timestamp) return null;
    return Date.now() - meeting.t0_timestamp.getTime();
  }

  private async requireMeetingAccess(userId: number, meetingId: number) {
    const meeting = await this.meetingRepo.findOne({
      where: { id: meetingId },
    });
    if (!meeting) throw new NotFoundException('회의를 찾을 수 없습니다.');
    await this.teamsService.requireMembership(userId, meeting.team_id);
    return meeting;
  }

  private async requireAgendaAccess(userId: number, agendaId: number) {
    const agenda = await this.agendaRepo.findOne({ where: { id: agendaId } });
    if (!agenda) throw new NotFoundException('안건을 찾을 수 없습니다.');
    const meeting = await this.requireMeetingAccess(userId, agenda.meeting_id);
    return { agenda, meeting };
  }
}
