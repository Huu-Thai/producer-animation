import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class SessionsController {
  constructor(private sessionsService: SessionsService) {}

  @Get('series/:seriesId/sessions')
  findAll(@Param('seriesId') seriesId: string) {
    return this.sessionsService.findAll(seriesId);
  }

  @Post('series/:seriesId/sessions')
  create(@Param('seriesId') seriesId: string, @Body() dto: CreateSessionDto) {
    return this.sessionsService.create(seriesId, dto);
  }

  @Patch('sessions/:id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateSessionDto>) {
    return this.sessionsService.update(id, dto);
  }
}
