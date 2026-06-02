import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type {
  AbsentMeetingHandling,
  ContributionVisibility,
  DeadlinePenaltyCurve,
} from '../../entities/team-settings.entity';

// 팀 기본 정보 + 일부 팀 설정값 수정.
// final_task_weight 는 그룹 생성 시에만 설정·이후 불변이므로 여기에 두지 않는다.
export class UpdateTeamDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  course_name?: string;

  @ApiPropertyOptional({ description: '정시 허용 지각 비율 (기본 0.10)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  punctuality_grace_ratio?: number;

  @ApiPropertyOptional({ description: '자리비움 차감 기준 초 (기본 30)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  presence_grace_seconds?: number;

  @ApiPropertyOptional({ description: 'char_count 절단 상한 (기본 500)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  max_utterance_chars?: number;

  @ApiPropertyOptional({ enum: ['standard', 'lenient', 'strict'] })
  @IsOptional()
  @IsIn(['standard', 'lenient', 'strict'])
  deadline_penalty_curve?: DeadlinePenaltyCurve;

  @ApiPropertyOptional({ enum: ['exclude', 'zero', 'attendance_only'] })
  @IsOptional()
  @IsIn(['exclude', 'zero', 'attendance_only'])
  absent_meeting_handling?: AbsentMeetingHandling;

  @ApiPropertyOptional({ description: '누적 반영 최소 회의 길이(분, 기본 5)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  min_meeting_minutes?: number;

  @ApiPropertyOptional({ description: '팀장 최종 점수 배율 (1.0 캡)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(2)
  leader_bonus_multiplier?: number;

  @ApiPropertyOptional({ enum: ['team', 'leader', 'self'] })
  @IsOptional()
  @IsIn(['team', 'leader', 'self'])
  contribution_visibility?: ContributionVisibility;
}
