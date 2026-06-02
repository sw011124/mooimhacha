import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type DecisionSource = 'manual' | 'ai_extracted';

@Entity('decisions')
export class Decision {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: number;

  @Column({ type: 'bigint', unsigned: true })
  meeting_id!: number;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'bigint', unsigned: true })
  created_by!: number;

  @Column({ type: 'varchar', length: 16, default: 'manual' })
  source!: DecisionSource;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  source_utterance_id!: number | null;

  // 입력 시점 진행 중 안건에 자동 연결
  @Column({ type: 'bigint', unsigned: true, nullable: true })
  agenda_id!: number | null;

  @Column({ type: 'boolean', default: false })
  confirmed!: boolean;

  @CreateDateColumn()
  created_at!: Date;
}
