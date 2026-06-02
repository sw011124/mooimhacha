import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class JoinTeamDto {
  @ApiProperty({ description: '초대 코드' })
  @IsString()
  @Length(4, 16)
  invite_code!: string;
}
