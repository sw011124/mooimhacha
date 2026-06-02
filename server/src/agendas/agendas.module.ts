import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agenda } from '../entities/agenda.entity';
import { Meeting } from '../entities/meeting.entity';
import { Utterance } from '../entities/utterance.entity';
import { TeamsModule } from '../teams/teams.module';
import { LlmModule } from '../llm/llm.module';
import { AgendasController } from './agendas.controller';
import { AgendasService } from './agendas.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Agenda, Meeting, Utterance]),
    TeamsModule,
    LlmModule,
  ],
  controllers: [AgendasController],
  providers: [AgendasService],
  exports: [AgendasService],
})
export class AgendasModule {}
