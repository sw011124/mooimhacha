import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTeamDto {
  @ApiProperty({ description: '팀 이름' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ description: '수업명 (선택)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  course_name?: string;
}
