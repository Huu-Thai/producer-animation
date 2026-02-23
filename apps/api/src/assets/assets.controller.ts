import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assets')
export class AssetsController {
  constructor(private assetsService: AssetsService) {}

  @Post('presign')
  presign(@Body() dto: { contentType: string; fileName: string; fileSize: number }) {
    return this.assetsService.presign(dto.contentType, dto.fileName, dto.fileSize);
  }

  @Get()
  findAll(@Query('type') type?: string) {
    return this.assetsService.findAll(type);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.assetsService.remove(id);
  }
}
