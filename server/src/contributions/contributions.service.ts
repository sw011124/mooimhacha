import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ContributionScore } from '../entities/contribution-score.entity';
import { Meeting } from '../entities/meeting.entity';
import { Agenda } from '../entities/agenda.entity';
import { Utterance } from '../entities/utterance.entity';
import { PresenceEvent } from '../entities/presence-event.entity';
import { AnomalyEvent } from '../entities/anomaly-event.entity';
import { ActionItem } from '../entities/action-item.entity';
import { TeamMembership } from '../entities/team-membership.entity';
import { TeamSettings } from '../entities/team-settings.entity';
import { User } from '../entities/user.entity';
import { TeamsService } from '../teams/teams.service';
import { ContributionClient } from './contribution.client';
import { TeamSettingsPayload } from './contribution.types';

@Injectable()
export class ContributionsService {
  constructor(
    @InjectRepository(ContributionScore)
    private scoreRepo: Repository<ContributionScore>,
    @InjectRepository(Meeting)
    private meetingRepo: Repository<Meeting>,
    @InjectRepository(Agenda)
    private agendaRepo: Repository<Agenda>,
    @InjectRepository(Utterance)
    private utteranceRepo: Repository<Utterance>,
    @InjectRepository(PresenceEvent)
    private presenceRepo: Repository<PresenceEvent>,
    @InjectRepository(AnomalyEvent)
    private anomalyRepo: Repository<AnomalyEvent>,
    @InjectRepository(ActionItem)
    private actionRepo: Repository<ActionItem>,
    @InjectRepository(TeamMembership)
    private membershipRepo: Repository<TeamMembership>,
    @InjectRepository(TeamSettings)
    private settingsRepo: Repository<TeamSettings>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private teamsService: TeamsService,
    private client: ContributionClient,
  ) {}

  // 회의 종료 시 호출 — 외부 서버에서 트랙1(①) 계산 후 우리 DB에 저장
  async computeAndStoreMeetingScores(
    meetingId: number,
  ): Promise<ContributionScore[]> {
    const meeting = await this.meetingRepo.findOne({
      where: { id: meetingId },
    });
    if (!meeting) return [];

    const settings = await this.requireSettingsPayload(meeting.team_id);
    const [utterances, agendas, presence, anomalies, members] =
      await Promise.all([
        this.utteranceRepo.find({ where: { meeting_id: meetingId } }),
        this.agendaRepo.find({ where: { meeting_id: meetingId } }),
        this.presenceRepo.find({ where: { meeting_id: meetingId } }),
        this.anomalyRepo.find({ where: { meeting_id: meetingId } }),
        this.membershipRepo.find({ where: { team_id: meeting.team_id } }),
      ]);

    // 참석자: presence join 기록자, 없으면 팀 멤버 전원
    const joined = new Set(
      presence.filter((p) => p.event_type === 'join').map((p) => p.user_id),
    );
    const participantIds =
      joined.size > 0 ? [...joined] : members.map((m) => m.user_id);

    const response = await this.client.computeMeetingScores({
      meeting: {
        id: meeting.id,
        total_minutes: meeting.total_minutes,
        t0_timestamp: meeting.t0_timestamp?.toISOString() ?? null,
        ended_at: meeting.ended_at?.toISOString() ?? null,
        meeting_type: meeting.meeting_type,
      },
      team_settings: settings,
      participant_user_ids: participantIds,
      utterances: utterances.map((u) => ({
        user_id: u.user_id,
        char_count: u.char_count,
        agenda_id: u.agenda_id,
        confidence: u.confidence,
      })),
      agendas: agendas.map((a) => ({ id: a.id, status: a.status })),
      presence_events: presence.map((p) => ({
        user_id: p.user_id,
        event_type: p.event_type,
        disconnect_classification: p.disconnect_classification,
        timestamp_offset_ms: p.timestamp_offset_ms,
      })),
      anomaly_events: anomalies.map((a) => ({
        user_id: a.user_id,
        event_type: a.event_type,
        timestamp_offset_ms: a.timestamp_offset_ms,
      })),
    });

    if (!response) return []; // 외부 서버 미설정 — 저장 건너뜀

    const saved: ContributionScore[] = [];
    for (const r of response.scores) {
      const existing = await this.scoreRepo.findOne({
        where: { user_id: r.user_id, meeting_id: meetingId },
      });
      const row =
        existing ??
        this.scoreRepo.create({ user_id: r.user_id, meeting_id: meetingId });
      row.speech_ratio = r.speech_ratio;
      row.speech_consistency = r.speech_consistency;
      row.attendance_ratio = r.attendance_ratio;
      row.punctuality_score = r.punctuality_score;
      row.meeting_score = r.meeting_score;
      row.confidence_level = r.confidence_level;
      row.excluded_indicators = r.excluded_indicators;
      saved.push(await this.scoreRepo.save(row));
    }
    return saved;
  }

  // ① 회의 기여도 — 저장값 조회 (참여자별)
  async getMeetingContributions(userId: number, meetingId: number) {
    const meeting = await this.meetingRepo.findOne({
      where: { id: meetingId },
    });
    if (!meeting) return { meeting_id: meetingId, scores: [] };
    await this.teamsService.requireMembership(userId, meeting.team_id);

    const scores = await this.scoreRepo.find({
      where: { meeting_id: meetingId },
    });
    const names = await this.userNames(scores.map((s) => s.user_id));
    return {
      meeting_id: meetingId,
      scores: scores.map((s) => ({
        user_id: s.user_id,
        name: names.get(s.user_id) ?? '알 수 없음',
        speech_ratio: s.speech_ratio,
        speech_consistency: s.speech_consistency,
        attendance_ratio: s.attendance_ratio,
        punctuality_score: s.punctuality_score,
        meeting_score: s.meeting_score,
        confidence_level: s.confidence_level,
        excluded_indicators: s.excluded_indicators,
      })),
    };
  }

  // ②③④ 회의 종합·테스크·종합 기여도 — 외부 서버 동적 계산
  async getTeamContributions(userId: number, teamId: number) {
    await this.teamsService.requireMembership(userId, teamId);
    const settings = await this.requireSettingsPayload(teamId);
    const members = await this.membershipRepo.find({
      where: { team_id: teamId },
    });
    const memberIds = members.map((m) => m.user_id);

    // 저장된 ① + 회의 메타
    const meetings = await this.meetingRepo.find({
      where: { team_id: teamId },
    });
    const meetingById = new Map(meetings.map((m) => [m.id, m]));
    const scores =
      meetings.length > 0
        ? await this.scoreRepo.find({
            where: { meeting_id: In(meetings.map((m) => m.id)) },
          })
        : [];
    const actions = await this.actionRepo.find({ where: { team_id: teamId } });

    const response = await this.client.computeTeamContributions({
      team_id: teamId,
      team_settings: settings,
      members: members.map((m) => ({ user_id: m.user_id, role: m.role })),
      meeting_scores: scores.map((s) => {
        const m = meetingById.get(s.meeting_id);
        return {
          user_id: s.user_id,
          meeting_id: s.meeting_id,
          meeting_score: s.meeting_score,
          total_minutes: m?.total_minutes ?? 0,
          meeting_type: m?.meeting_type ?? 'regular',
          is_invalidated: m?.is_invalidated ?? false,
        };
      }),
      action_items: actions.map((a) => ({
        assignee_id: a.assignee_id,
        status: a.status,
        difficulty: a.difficulty,
        due_date: a.due_date?.toISOString() ?? null,
        completed_at: a.completed_at?.toISOString() ?? null,
        confirmed: a.confirmed,
      })),
    });

    const names = await this.userNames(memberIds);
    const roleById = new Map(members.map((m) => [m.user_id, m.role]));
    const resultById = new Map(
      (response?.members ?? []).map((r) => [r.user_id, r]),
    );
    return {
      team_id: teamId,
      computed: !!response,
      members: memberIds.map((uid) => {
        const r = resultById.get(uid);
        return {
          user_id: uid,
          name: names.get(uid) ?? '알 수 없음',
          role: roleById.get(uid),
          meeting_aggregate: r?.meeting_aggregate ?? null,
          task_score: r?.task_score ?? null,
          composite_score: r?.composite_score ?? null,
        };
      }),
    };
  }

  private async requireSettingsPayload(
    teamId: number,
  ): Promise<TeamSettingsPayload> {
    const s = await this.settingsRepo.findOne({ where: { team_id: teamId } });
    // 설정이 없으면 문서 06 기본값으로 구성
    return {
      punctuality_grace_ratio: s?.punctuality_grace_ratio ?? 0.1,
      presence_grace_seconds: s?.presence_grace_seconds ?? 30,
      max_utterance_chars: s?.max_utterance_chars ?? 500,
      deadline_penalty_curve: s?.deadline_penalty_curve ?? 'standard',
      absent_meeting_handling: s?.absent_meeting_handling ?? 'exclude',
      min_meeting_minutes: s?.min_meeting_minutes ?? 5,
      final_task_weight: s?.final_task_weight ?? 0.5,
      leader_bonus_multiplier: s?.leader_bonus_multiplier ?? 1.0,
    };
  }

  private async userNames(ids: number[]): Promise<Map<number, string>> {
    if (ids.length === 0) return new Map();
    const users = await this.userRepo.find({ where: { id: In(ids) } });
    return new Map(users.map((u) => [u.id, u.name]));
  }
}
