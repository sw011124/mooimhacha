import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Team } from '../entities/team.entity';
import { TeamMembership } from '../entities/team-membership.entity';
import { TeamSettings } from '../entities/team-settings.entity';
import { User } from '../entities/user.entity';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Team, TeamMembership, TeamSettings, User]),
  ],
  controllers: [TeamsController],
  providers: [TeamsService],
  // 다른 모듈(회의·기여도)에서 멤버십 검증·설정 조회에 재사용
  exports: [TeamsService],
})
export class TeamsModule {}
