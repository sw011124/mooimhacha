import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// 트랙1 회의 기여도(①)만 회의 단위로 저장(고정값). ②③④는 저장 없이 조회 시점 동적 계산.
@Entity('contribution_scores')
@Index(['user_id', 'meeting_id'], { unique: true })
export class ContributionScore {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: number;

  @Column({ type: 'bigint', unsigned: true })
  user_id!: number;

  @Column({ type: 'bigint', unsigned: true })
  meeting_id!: number;

  @Column({ type: 'float', nullable: true })
  speech_ratio!: number | null;

  @Column({ type: 'float', nullable: true })
  speech_consistency!: number | null;

  @Column({ type: 'float', nullable: true })
  attendance_ratio!: number | null;

  @Column({ type: 'float', nullable: true })
  punctuality_score!: number | null;

  // 발언×0.6 + 참석×0.4 (측정 불가 축은 분모서 제외)
  @Column({ type: 'float', nullable: true })
  meeting_score!: number | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  confidence_level!: string | null;

  // 측정 불가로 분모서 제외된 지표 목록
  @Column({ type: 'json', nullable: true })
  excluded_indicators!: string[] | null;

  @CreateDateColumn()
  created_at!: Date;
}
