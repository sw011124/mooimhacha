import { Column, Entity, PrimaryColumn } from 'typeorm';

export type DeadlinePenaltyCurve = 'standard' | 'lenient' | 'strict';
export type AbsentMeetingHandling = 'exclude' | 'zero' | 'attendance_only';
export type ContributionVisibility = 'team' | 'leader' | 'self';

// 기여도 산정에 쓰이는 팀별 설정값. 세부 가중치(축 0.6/0.4·난이도)는 전역 고정이며
// 여기에는 두지 않는다. 상세 식 연동은 docs/06-기여도-산정.md 참고.
@Entity('team_settings')
export class TeamSettings {
  @PrimaryColumn({ type: 'bigint', unsigned: true })
  team_id!: number;

  // 정시: 허용 지각 = total_minutes × 비율
  @Column({ type: 'float', default: 0.1 })
  punctuality_grace_ratio!: number;

  // 출석: 이 시간 이상 이탈만 자리비움으로 차감
  @Column({ type: 'int', default: 30 })
  presence_grace_seconds!: number;

  // 발언: char_count 절단 상한
  @Column({ type: 'int', default: 500 })
  max_utterance_chars!: number;

  @Column({ type: 'varchar', length: 16, default: 'standard' })
  deadline_penalty_curve!: DeadlinePenaltyCurve;

  @Column({ type: 'varchar', length: 24, default: 'exclude' })
  absent_meeting_handling!: AbsentMeetingHandling;

  // 누적 반영 최소 회의 길이(분)
  @Column({ type: 'int', default: 5 })
  min_meeting_minutes!: number;

  // ④ 최종 합산의 테스크 비중 w — 그룹 생성 시에만 설정·이후 불변
  @Column({ type: 'float', default: 0.5 })
  final_task_weight!: number;

  // ④ 팀장 최종 점수 배율 (1.0 캡)
  @Column({ type: 'float', default: 1.0 })
  leader_bonus_multiplier!: number;

  @Column({ type: 'varchar', length: 16, default: 'team' })
  contribution_visibility!: ContributionVisibility;
}
