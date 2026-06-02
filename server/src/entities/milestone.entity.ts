import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// 3계층 목표 구조: 프로젝트 > 마일스톤 > 회의별 목표(agenda.milestone_id).
// 진척도(progress_ratio)는 하위 안건 완료율로 자동 계산.
@Entity('milestones')
export class Milestone {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: number;

  @Column({ type: 'bigint', unsigned: true })
  project_id!: number;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'datetime', nullable: true })
  deadline!: Date | null;

  // 정렬 순서 (예약어 회피 위해 order_index 사용)
  @Column({ type: 'int', default: 0 })
  order_index!: number;

  @Column({ type: 'float', default: 0 })
  progress_ratio!: number;
}
