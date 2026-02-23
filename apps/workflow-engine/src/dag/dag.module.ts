import { Module } from '@nestjs/common';
import { DagService } from './dag.service';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';
import { QueuesModule } from '../queues/queues.module';

@Module({
  imports: [QueuesModule],
  providers: [DagService, WorkflowService],
  controllers: [WorkflowController],
  exports: [WorkflowService],
})
export class DagModule {}
