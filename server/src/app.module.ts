import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { TeamsModule } from './teams/teams.module';
import { MeetingsModule } from './meetings/meetings.module';
import { AgendasModule } from './agendas/agendas.module';
import { DecisionsModule } from './decisions/decisions.module';
import { ActionItemsModule } from './action-items/action-items.module';
import { ContributionsModule } from './contributions/contributions.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ALL_ENTITIES } from './entities';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        entities: ALL_ENTITIES,
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        timezone: '+09:00',
        // 한글 등 멀티바이트 문자 깨짐(???) 방지
        charset: 'utf8mb4',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    TeamsModule,
    MeetingsModule,
    AgendasModule,
    DecisionsModule,
    ActionItemsModule,
    ContributionsModule,
    RealtimeModule,
  ],
})
export class AppModule {}
