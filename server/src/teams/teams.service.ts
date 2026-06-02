import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Team } from '../entities/team.entity';
import { TeamMembership } from '../entities/team-membership.entity';
import { TeamSettings } from '../entities/team-settings.entity';
import { User } from '../entities/user.entity';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';

// 대학생 팀플 기준 하드 제한
export const MAX_TEAM_MEMBERS = 6;

// 혼동되는 글자(0/O, 1/I/L) 제외한 초대 코드용 문자셋
const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private teamRepo: Repository<Team>,
    @InjectRepository(TeamMembership)
    private membershipRepo: Repository<TeamMembership>,
    @InjectRepository(TeamSettings)
    private settingsRepo: Repository<TeamSettings>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async create(userId: number, dto: CreateTeamDto) {
    const team = await this.teamRepo.save(
      this.teamRepo.create({
        name: dto.name,
        course_name: dto.course_name ?? null,
        created_by: userId,
      }),
    );
    // 생성자는 팀장 멤버십, 팀 설정은 기본값으로 생성
    await this.settingsRepo.save(
      this.settingsRepo.create({ team_id: team.id }),
    );
    await this.membershipRepo.save(
      this.membershipRepo.create({
        team_id: team.id,
        user_id: userId,
        role: 'leader',
      }),
    );
    return this.getOne(userId, team.id);
  }

  async listForUser(userId: number) {
    const memberships = await this.membershipRepo.find({
      where: { user_id: userId },
    });
    if (memberships.length === 0) return [];
    const teams = await this.teamRepo.find({
      where: { id: In(memberships.map((m) => m.team_id)) },
    });
    const roleByTeam = new Map(memberships.map((m) => [m.team_id, m.role]));
    return teams.map((t) => ({
      id: t.id,
      name: t.name,
      course_name: t.course_name,
      role: roleByTeam.get(t.id),
    }));
  }

  async getOne(userId: number, teamId: number) {
    await this.requireMembership(userId, teamId);
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) throw new NotFoundException('팀을 찾을 수 없습니다.');
    const settings = await this.settingsRepo.findOne({
      where: { team_id: teamId },
    });
    const members = await this.getMembers(teamId);
    return { ...team, settings, members };
  }

  async getMembers(teamId: number) {
    const memberships = await this.membershipRepo.find({
      where: { team_id: teamId },
    });
    if (memberships.length === 0) return [];
    const users = await this.userRepo.find({
      where: { id: In(memberships.map((m) => m.user_id)) },
    });
    const userById = new Map(users.map((u) => [u.id, u]));
    return memberships.map((m) => {
      const u = userById.get(m.user_id);
      return {
        user_id: m.user_id,
        name: u?.name ?? '알 수 없음',
        profile_image_url: u?.profile_image_url ?? null,
        role: m.role,
        joined_at: m.joined_at,
      };
    });
  }

  async update(userId: number, teamId: number, dto: UpdateTeamDto) {
    await this.requireLeader(userId, teamId);
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) throw new NotFoundException('팀을 찾을 수 없습니다.');

    if (dto.name !== undefined) team.name = dto.name;
    if (dto.course_name !== undefined) team.course_name = dto.course_name;
    await this.teamRepo.save(team);

    // 팀 설정값 부분 갱신
    const settings = await this.settingsRepo.findOne({
      where: { team_id: teamId },
    });
    if (settings) {
      if (dto.punctuality_grace_ratio !== undefined)
        settings.punctuality_grace_ratio = dto.punctuality_grace_ratio;
      if (dto.presence_grace_seconds !== undefined)
        settings.presence_grace_seconds = dto.presence_grace_seconds;
      if (dto.max_utterance_chars !== undefined)
        settings.max_utterance_chars = dto.max_utterance_chars;
      if (dto.deadline_penalty_curve !== undefined)
        settings.deadline_penalty_curve = dto.deadline_penalty_curve;
      if (dto.absent_meeting_handling !== undefined)
        settings.absent_meeting_handling = dto.absent_meeting_handling;
      if (dto.min_meeting_minutes !== undefined)
        settings.min_meeting_minutes = dto.min_meeting_minutes;
      if (dto.leader_bonus_multiplier !== undefined)
        settings.leader_bonus_multiplier = dto.leader_bonus_multiplier;
      if (dto.contribution_visibility !== undefined)
        settings.contribution_visibility = dto.contribution_visibility;
      await this.settingsRepo.save(settings);
    }
    return this.getOne(userId, teamId);
  }

  async createInvitation(
    userId: number,
    teamId: number,
    dto: CreateInvitationDto,
  ) {
    await this.requireLeader(userId, teamId);
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) throw new NotFoundException('팀을 찾을 수 없습니다.');

    team.invite_code = await this.generateUniqueCode();
    team.invite_code_expires_at = dto.expires_in_hours
      ? new Date(Date.now() + dto.expires_in_hours * 3600 * 1000)
      : null;
    await this.teamRepo.save(team);

    return {
      invite_code: team.invite_code,
      expires_at: team.invite_code_expires_at,
    };
  }

  async join(userId: number, code: string) {
    const team = await this.teamRepo.findOne({
      where: { invite_code: code },
    });
    if (!team) throw new NotFoundException('유효하지 않은 초대 코드입니다.');
    if (
      team.invite_code_expires_at &&
      team.invite_code_expires_at.getTime() < Date.now()
    ) {
      throw new BadRequestException('만료된 초대 코드입니다.');
    }

    const existing = await this.membershipRepo.findOne({
      where: { team_id: team.id, user_id: userId },
    });
    if (existing) {
      throw new BadRequestException('이미 가입한 팀입니다.');
    }

    const count = await this.membershipRepo.count({
      where: { team_id: team.id },
    });
    if (count >= MAX_TEAM_MEMBERS) {
      throw new BadRequestException(
        `팀 인원이 가득 찼습니다. (최대 ${MAX_TEAM_MEMBERS}명)`,
      );
    }

    await this.membershipRepo.save(
      this.membershipRepo.create({
        team_id: team.id,
        user_id: userId,
        role: 'member',
      }),
    );
    return this.getOne(userId, team.id);
  }

  // --- 권한 헬퍼 ---

  async requireMembership(userId: number, teamId: number) {
    const m = await this.membershipRepo.findOne({
      where: { team_id: teamId, user_id: userId },
    });
    if (!m) throw new ForbiddenException('팀 멤버가 아닙니다.');
    return m;
  }

  async requireLeader(userId: number, teamId: number) {
    const m = await this.requireMembership(userId, teamId);
    if (m.role !== 'leader') {
      throw new ForbiddenException('팀장만 수행할 수 있습니다.');
    }
    return m;
  }

  private async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      let code = '';
      for (let i = 0; i < 8; i++) {
        code +=
          INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
      }
      const dup = await this.teamRepo.findOne({ where: { invite_code: code } });
      if (!dup) return code;
    }
    throw new BadRequestException(
      '초대 코드 생성에 실패했습니다. 다시 시도하세요.',
    );
  }
}
