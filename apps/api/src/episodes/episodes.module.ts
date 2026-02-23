import { Module } from '@nestjs/common';
import { EpisodesService } from './episodes.service';
import { EpisodesController } from './episodes.controller';

@Module({
  providers: [EpisodesService],
  controllers: [EpisodesController],
  exports: [EpisodesService],
})
export class EpisodesModule {}
