import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../entities/user.entity';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';

@ApiTags('회의')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('meetings')
export class MeetingsController {
  constructor(private meetingsService: MeetingsService) {}

  @Get()
  @ApiOperation({ summary: '회의 목록 (team_id로 필터 가능)' })
  list(@Request() req: { user: User }, @Query('team_id') teamId?: string) {
    return this.meetingsService.list(
      req.user.id,
      teamId ? Number(teamId) : undefined,
    );
  }

  @Post()
  @ApiOperation({ summary: '회의 생성' })
  create(@Request() req: { user: User }, @Body() dto: CreateMeetingDto) {
    return this.meetingsService.create(req.user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: '회의 상세' })
  get(@Request() req: { user: User }, @Param('id', ParseIntPipe) id: number) {
    return this.meetingsService.get(req.user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '회의 수정' })
  update(
    @Request() req: { user: User },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMeetingDto,
  ) {
    return this.meetingsService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '회의 삭제 (팀장)' })
  remove(
    @Request() req: { user: User },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.meetingsService.remove(req.user.id, id);
  }

  @Post(':id/start')
  @ApiOperation({ summary: '회의 시작 — T0 발행' })
  start(@Request() req: { user: User }, @Param('id', ParseIntPipe) id: number) {
    return this.meetingsService.start(req.user.id, id);
  }

  @Post(':id/end')
  @ApiOperation({ summary: '회의 종료 — 그루핑 + 기여도 산정 트리거' })
  end(@Request() req: { user: User }, @Param('id', ParseIntPipe) id: number) {
    return this.meetingsService.end(req.user.id, id);
  }

  @Get(':id/transcript')
  @ApiOperation({ summary: '회의록 (안건별 그루핑)' })
  transcript(
    @Request() req: { user: User },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.meetingsService.getTranscript(req.user.id, id);
  }
}
