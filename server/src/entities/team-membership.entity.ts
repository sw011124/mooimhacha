import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type TeamRole = 'leader' | 'member';

@Entity('team_memberships')
@Index(['team_id', 'user_id'], { unique: true })
export class TeamMembership {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: number;

  @Column({ type: 'bigint', unsigned: true })
  team_id!: number;

  @Column({ type: 'bigint', unsigned: true })
  user_id!: number;

  @Column({ type: 'varchar', length: 16, default: 'member' })
  role!: TeamRole;

  @CreateDateColumn()
  joined_at!: Date;
}
