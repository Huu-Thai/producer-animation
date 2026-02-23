import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import axios from 'axios';

export interface NodeJobData {
  episodeId: string;
  nodeId: string;
  nodeType: string;
  config: Record<string, any>;
  inputs: Record<string, any>;
  workflow: any;
  workflowVersion: number;
}

const NODE_TIMEOUT_MS: Record<string, number> = {
  scene_parser: 60_000,
  image_gen: 120_000,
  motion: 360_000,
  voice: 60_000,
  timeline: 60_000,
  render: 660_000,
  publish: 300_000,
};

@Injectable()
export class WorkflowQueue implements OnModuleInit, OnModuleDestroy {
  private queue: Queue;
  private dlqQueue: Queue;
  private worker: Worker;
  private readonly logger = new Logger(WorkflowQueue.name);
  private connection: IORedis;

  onModuleInit() {
    this.connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });

    this.queue = new Queue('workflow:nodes', { connection: this.connection });
    this.dlqQueue = new Queue('workflow:dlq', { connection: this.connection });

    this.worker = new Worker(
      'workflow:nodes',
      async (job: Job<NodeJobData>) => {
        const { episodeId, nodeId, nodeType, config, inputs, workflow } = job.data;
        const timeout = NODE_TIMEOUT_MS[nodeType] ?? 120_000;

        this.logger.log(`Executing ${nodeType}:${nodeId} for episode ${episodeId}`);

        // Mark running
        await axios
          .post(
            `${process.env.API_URL}/internal/node/status`,
            { episodeId, nodeId, status: 'running' },
            { headers: { 'x-internal-secret': process.env.INTERNAL_SECRET } },
          )
          .catch(() => {});

        // Call AI Gateway
        const response = await axios.post(
          `${process.env.AI_GATEWAY_URL}/tasks/execute`,
          { episodeId, nodeId, nodeType, config, inputs },
          {
            timeout,
            headers: { 'x-internal-secret': process.env.INTERNAL_SECRET },
          },
        );

        const output = response.data;

        // Notify workflow engine of node completion
        const engineUrl = process.env.WORKFLOW_ENGINE_URL ?? 'http://localhost:3002';
        await axios.post(
          `${engineUrl}/internal/workflow/node-complete`,
          { episodeId, nodeId, output, workflow },
          { headers: { 'x-internal-secret': process.env.INTERNAL_SECRET } },
        );

        return output;
      },
      {
        connection: this.connection,
        concurrency: 10,
      },
    );

    this.worker.on('failed', async (job, err) => {
      if (!job) return;
      this.logger.error(`Job ${job.id} failed (attempt ${job.attemptsMade}): ${err.message}`);

      if (job.attemptsMade >= 3) {
        this.logger.error(`Job ${job.id} moved to DLQ`);
        await this.dlqQueue.add('dlq', job.data, {
          jobId: `dlq:${job.id}`,
        });

        // Slack alert on DLQ arrival
        if (process.env.SLACK_WEBHOOK_URL) {
          axios
            .post(process.env.SLACK_WEBHOOK_URL, {
              text: `🚨 *DLQ Alert* – Job \`${job.id}\` moved to dead letter queue after ${job.attemptsMade} attempts\n*Episode:* ${job.data.episodeId}\n*Node:* ${job.data.nodeType}:${job.data.nodeId}\n*Error:* ${err.message}`,
            })
            .catch((e) => this.logger.error('Slack DLQ alert failed', e.message));
        }

        // Notify workflow engine of node failure
        const engineUrl = process.env.WORKFLOW_ENGINE_URL ?? 'http://localhost:3002';
        await axios
          .post(
            `${engineUrl}/internal/workflow/node-failed`,
            {
              episodeId: job.data.episodeId,
              nodeId: job.data.nodeId,
              error: err.message,
            },
            { headers: { 'x-internal-secret': process.env.INTERNAL_SECRET } },
          )
          .catch(() => {});
      }
    });

    this.logger.log('WorkflowQueue initialized');
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    await this.dlqQueue?.close();
    await this.connection?.quit();
  }

  async enqueueNode(data: NodeJobData) {
    const jobId = `${data.episodeId}:${data.nodeId}`;
    await this.queue.add('node', data, {
      jobId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    });
    this.logger.log(`Enqueued node ${data.nodeType}:${data.nodeId}`);
  }

  async replayDlqJob(jobId: string) {
    const job = await this.dlqQueue.getJob(jobId);
    if (!job) throw new Error('DLQ job not found');
    await this.queue.add('node', job.data as NodeJobData);
    return { replayed: true, jobId };
  }
}
