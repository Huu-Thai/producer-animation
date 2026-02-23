import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  Headers,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ChannelsService } from './channels.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('channels')
@Controller()
export class ChannelsController {
  constructor(private channelsService: ChannelsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('series/:seriesId/channels')
  findAll(@Param('seriesId') seriesId: string) {
    return this.channelsService.findAll(seriesId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('channels/youtube/auth')
  getAuthUrl(@Query('seriesId') seriesId: string) {
    return { url: this.channelsService.getYouTubeAuthUrl(seriesId) };
  }

  @Get('channels/youtube/callback')
  async callback(@Query('code') code: string, @Query('state') seriesId: string) {
    return this.channelsService.handleCallback(code, seriesId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('channels/:id')
  remove(@Param('id') id: string) {
    return this.channelsService.remove(id);
  }

  // Internal endpoint for AI Gateway to get decrypted channel config
  @Get('internal/channels/:id/config')
  getConfig(@Param('id') id: string, @Headers('x-internal-secret') secret: string) {
    if (secret !== process.env.INTERNAL_SECRET) throw new UnauthorizedException();
    return this.channelsService.getDecryptedConfig(id);
  }
}
