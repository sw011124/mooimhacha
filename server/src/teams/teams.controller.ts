import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../entities/user.entity';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { JoinTeamDto } from './dto/join-team.dto';

@ApiTags('팀')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('teams')
export class TeamsController {
  constructor(private teamsService: TeamsService) {}

  @Get()
  @ApiOperation({ summary: '내가 속한 팀 목록' })
  list(@Request() req: { user: User }) {
    return this.teamsService.listForUser(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: '팀 생성 (생성자가 팀장)' })
  create(@Request() req: { user: User }, @Body() dto: CreateTeamDto) {
    return this.teamsService.create(req.user.id, dto);
  }

  @Post('join')
  @ApiOperation({ summary: '초대 코드로 팀 합류' })
  join(@Request() req: { user: User }, @Body() dto: JoinTeamDto) {
    return this.teamsService.join(req.user.id, dto.invite_code);
  }

  @Get(':id')
  @ApiOperation({ summary: '팀 상세 (설정·멤버 포함)' })
  getOne(
    @Request() req: { user: User },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.teamsService.getOne(req.user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '팀 정보·설정 수정 (팀장)' })
  update(
    @Request() req: { user: User },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.teamsService.update(req.user.id, id, dto);
  }

  @Post(':id/invitations')
  @ApiOperation({ summary: '초대 코드 발급·재발급 (팀장)' })
  createInvitation(
    @Request() req: { user: User },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.teamsService.createInvitation(req.user.id, id, dto);
  }
}
