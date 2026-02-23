import { Module } from '@nestjs/common';
import { TaskRouterModule } from './task-router/task-router.module';

@Module({
  imports: [TaskRouterModule],
})
export class AppModule {}
