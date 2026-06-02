import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Meeting } from '../entities/meeting.entity';
import { Agenda } from '../entities/agenda.entity';
import { Utterance } from '../entities/utterance.entity';
import { TeamMembership } from '../entities/team-membership.entity';
import { TeamsModule } from '../teams/teams.module';
import { ContributionsModule } from '../contributions/contributions.module';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Meeting, Agenda, Utterance, TeamMembership]),
    TeamsModule,
    ContributionsModule,
  ],
  controllers: [MeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
