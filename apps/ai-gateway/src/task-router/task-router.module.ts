import { Module } from '@nestjs/common';
import { TaskRouterService } from './task-router.service';
import { TaskRouterController } from './task-router.controller';

@Module({
  providers: [TaskRouterService],
  controllers: [TaskRouterController],
})
export class TaskRouterModule {}
