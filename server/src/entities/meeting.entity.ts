import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type MeetingStatus = 'scheduled' | 'active' | 'ended';
// regular만 산정, partial은 누적 미반영, test는 산정하되 누적 제외
export type MeetingType = 'regular' | 'partial' | 'test';

@Entity('meetings')
export class Meeting {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: number;

  @Column({ type: 'bigint', unsigned: true })
  team_id!: number;

  @Column({ type: 'datetime' })
  scheduled_at!: Date;

  // 총 예상 시간(분)
  @Column({ type: 'int' })
  total_minutes!: number;

  // 주제 (선택)
  @Column({ type: 'varchar', length: 200, nullable: true })
  topic!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'scheduled' })
  status!: MeetingStatus;

  // 시각 동기화 기준점 (start 시 발행)
  @Column({ type: 'datetime', nullable: true })
  t0_timestamp!: Date | null;

  // 실제 종료 시각 — 출석 분모 = ended_at − t0_timestamp
  @Column({ type: 'datetime', nullable: true })
  ended_at!: Date | null;

  @Column({ type: 'varchar', length: 16, default: 'regular' })
  meeting_type!: MeetingType;

  // 팀장 수동 무효 처리 시 누적·기여도 제외 (docs/09)
  @Column({ type: 'boolean', default: false })
  is_invalidated!: boolean;

  // 회의 후 AI 종합 정리로 생성
  @Column({ type: 'text', nullable: true })
  summary!: string | null;

  @CreateDateColumn()
  created_at!: Date;
}
