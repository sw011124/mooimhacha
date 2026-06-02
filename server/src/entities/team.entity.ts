import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: number;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  // 수업명 (선택)
  @Column({ type: 'varchar', length: 100, nullable: true })
  course_name!: string | null;

  // 팀 생성자 user_id
  @Column({ type: 'bigint', unsigned: true })
  created_by!: number;

  // 현재 유효한 초대 코드 (재발급 시 갱신, 만료 설정 가능)
  @Column({ type: 'varchar', length: 16, nullable: true, unique: true })
  invite_code!: string | null;

  @Column({ type: 'datetime', nullable: true })
  invite_code_expires_at!: Date | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @DeleteDateColumn()
  deleted_at!: Date | null;
}
