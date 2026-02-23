import { Module } from '@nestjs/common';
import { WorkflowQueue } from './workflow.queue';

@Module({
  providers: [WorkflowQueue],
  exports: [WorkflowQueue],
})
export class QueuesModule {}
