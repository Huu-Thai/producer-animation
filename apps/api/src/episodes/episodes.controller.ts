import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { EpisodesService } from './episodes.service';
import { CreateEpisodeDto, UpdateEpisodeDto } from './dto/create-episode.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('episodes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class EpisodesController {
  constructor(private episodesService: EpisodesService) {}

  @Get('series/:seriesId/episodes')
  findAll(@Param('seriesId') seriesId: string, @Query('status') status?: string) {
    return this.episodesService.findAll(seriesId, status);
  }

  @Post('series/:seriesId/episodes')
  create(@Param('seriesId') seriesId: string, @Body() dto: CreateEpisodeDto) {
    return this.episodesService.create(seriesId, dto);
  }

  @Get('episodes/:id')
  findOne(@Param('id') id: string) {
    return this.episodesService.findOne(id);
  }

  @Patch('episodes/:id')
  update(@Param('id') id: string, @Body() dto: UpdateEpisodeDto) {
    return this.episodesService.update(id, dto);
  }

  @Delete('episodes/:id')
  remove(@Param('id') id: string) {
    return this.episodesService.remove(id);
  }

  @Post('episodes/:id/scripts')
  uploadScript(@Param('id') id: string, @Body() dto: { rawScript: string; language?: string }) {
    return this.episodesService.uploadScript(id, dto.rawScript, dto.language);
  }

  @Post('episodes/:id/workflow/start')
  startWorkflow(@Param('id') id: string) {
    return this.episodesService.startWorkflow(id);
  }
}
