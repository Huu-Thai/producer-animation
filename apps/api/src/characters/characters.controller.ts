import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CharactersService } from './characters.service';
import { CreateCharacterDto } from './dto/create-character.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('characters')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class CharactersController {
  constructor(private charactersService: CharactersService) {}

  @Get('series/:seriesId/characters')
  findAll(@Param('seriesId') seriesId: string) {
    return this.charactersService.findAll(seriesId);
  }

  @Post('series/:seriesId/characters')
  create(@Param('seriesId') seriesId: string, @Body() dto: CreateCharacterDto) {
    return this.charactersService.create(seriesId, dto);
  }

  @Patch('characters/:id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateCharacterDto>) {
    return this.charactersService.update(id, dto);
  }

  @Delete('characters/:id')
  remove(@Param('id') id: string) {
    return this.charactersService.remove(id);
  }

  @Post('characters/voice-preview')
  voicePreview(@Body() dto: { voiceId: string; text?: string }) {
    return this.charactersService.previewVoice(dto.voiceId, dto.text);
  }
}
