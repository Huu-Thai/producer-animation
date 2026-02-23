import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma.module';
import { DagModule } from './dag/dag.module';
import { QueuesModule } from './queues/queues.module';

@Module({
  imports: [PrismaModule, QueuesModule, DagModule],
})
export class AppModule {}
