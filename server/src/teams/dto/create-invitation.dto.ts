import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class CreateInvitationDto {
  @ApiPropertyOptional({
    description: '초대 코드 유효 시간(시간). 미지정 시 만료 없음.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  expires_in_hours?: number;
}
