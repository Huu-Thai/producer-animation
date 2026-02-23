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
import { SeriesService } from './series.service';
import { CreateSeriesDto, UpdateSeriesDto } from './dto/create-series.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators';

@ApiTags('series')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('series')
export class SeriesController {
  constructor(private seriesService: SeriesService) {}

  @Get()
  findAll(@CurrentUser() user: any, @Query('page') page = 1, @Query('limit') limit = 20) {
    return this.seriesService.findAll(user.id, +page, +limit);
  }

  @Post()
  create(@Body() dto: CreateSeriesDto, @CurrentUser() user: any) {
    return this.seriesService.create(dto, user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.seriesService.findOne(id, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSeriesDto, @CurrentUser() user: any) {
    return this.seriesService.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.seriesService.remove(id, user.id);
  }
}
