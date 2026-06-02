import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// stt_failure는 활성 윈도우서 차감 (말은 했으나 인식 실패한 구간 기록)
export type AnomalyEventType =
  | 'capture_loss'
  | 'inference_fail'
  | 'stt_failure';

@Entity('anomaly_events')
@Index(['meeting_id', 'user_id'])
export class AnomalyEvent {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: number;

  @Column({ type: 'bigint', unsigned: true })
  user_id!: number;

  @Column({ type: 'bigint', unsigned: true })
  meeting_id!: number;

  @Column({ type: 'varchar', length: 24 })
  event_type!: AnomalyEventType;

  @Column({ type: 'int' })
  timestamp_offset_ms!: number;

  @Column({ type: 'varchar', length: 16, nullable: true })
  severity!: string | null;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;
}
