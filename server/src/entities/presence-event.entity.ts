import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type PresenceEventType = 'join' | 'leave' | 'disconnect' | 'reconnect';
// 비자발 끊김은 활성 윈도우·출석 분모서 차감
export type DisconnectClassification = 'voluntary' | 'involuntary';
export type PresenceReason =
  | 'user_action'
  | 'network'
  | 'browser_close'
  | 'timeout';

@Entity('presence_events')
@Index(['meeting_id', 'user_id'])
export class PresenceEvent {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: number;

  @Column({ type: 'bigint', unsigned: true })
  user_id!: number;

  @Column({ type: 'bigint', unsigned: true })
  meeting_id!: number;

  @Column({ type: 'varchar', length: 16 })
  event_type!: PresenceEventType;

  @Column({ type: 'varchar', length: 16, nullable: true })
  disconnect_classification!: DisconnectClassification | null;

  @Column({ type: 'int' })
  timestamp_offset_ms!: number;

  @Column({ type: 'varchar', length: 16, nullable: true })
  reason!: PresenceReason | null;
}
