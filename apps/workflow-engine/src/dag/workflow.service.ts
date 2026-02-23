import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../common/prisma.service';
import { DagService, WorkflowDefinition } from './dag.service';
import { WorkflowQueue } from '../queues/workflow.queue';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private prisma: PrismaService,
    private dagService: DagService,
    private workflowQueue: WorkflowQueue,
  ) {}

  async startWorkflow(episodeId: string, workflow: WorkflowDefinition, workflowVersion: number) {
    const { nodes } = workflow;
    const analysis = this.dagService.analyzeWorkflow(workflow);

    // Create node_runs for all nodes (idempotent upsert)
    await Promise.all(
      nodes.map((node) =>
        this.prisma.nodeRun.upsert({
          where: { episodeId_nodeId: { episodeId, nodeId: node.id } },
          create: {
            episodeId,
            nodeId: node.id,
            nodeType: node.type,
            status: 'pending',
            config: node.config,
          },
          update: {
            status: 'pending',
            output: undefined,
            error: null,
            startedAt: null,
            completedAt: null,
          },
        }),
      ),
    );

    // Enqueue root nodes
    for (const rootNodeId of analysis.rootNodes) {
      const node = nodes.find((n) => n.id === rootNodeId)!;
      await this.workflowQueue.enqueueNode({
        episodeId,
        nodeId: rootNodeId,
        nodeType: node.type,
        config: node.config,
        inputs: {},
        workflow,
        workflowVersion,
      });
    }

    this.logger.log(
      `Workflow started for episode ${episodeId}, root nodes: ${analysis.rootNodes.join(', ')}`,
    );
    return { started: true, rootNodes: analysis.rootNodes };
  }

  async handleNodeComplete(
    episodeId: string,
    nodeId: string,
    output: any,
    workflow: WorkflowDefinition,
  ) {
    const { edges, nodes } = workflow;
    const analysis = this.dagService.analyzeWorkflow(workflow);

    // Mark node as completed
    await this.prisma.nodeRun.updateMany({
      where: { episodeId, nodeId },
      data: { status: 'completed', output, completedAt: new Date() },
    });

    const children = analysis.adjacency.get(nodeId) ?? [];

    for (const childId of children) {
      const parentIds = this.dagService.getParentIds(childId, edges);
      const parentRuns = await this.prisma.nodeRun.findMany({
        where: { episodeId, nodeId: { in: parentIds } },
      });

      const allParentsDone = parentRuns.every((r: { status: string }) => r.status === 'completed');
      if (!allParentsDone) continue;

      // Gather parent outputs as inputs for child
      const inputs: Record<string, any> = {};
      for (const parentRun of parentRuns) {
        inputs[parentRun.nodeId] = parentRun.output;
      }

      const childNode = nodes.find((n) => n.id === childId)!;
      await this.workflowQueue.enqueueNode({
        episodeId,
        nodeId: childId,
        nodeType: childNode.type,
        config: childNode.config,
        inputs,
        workflow,
        workflowVersion: 1,
      });
    }

    // Check if all nodes are completed
    const allRuns = await this.prisma.nodeRun.findMany({ where: { episodeId } });
    const allDone = allRuns.every((r: { status: string }) => r.status === 'completed');

    if (allDone) {
      const renderRun = allRuns.find((r: { nodeType: string }) => r.nodeType === 'render');
      const finalVideoUrl = (renderRun?.output as any)?.final_video_url ?? '';
      const thumbnailUrl = (renderRun?.output as any)?.thumbnail_url ?? '';

      this.logger.log(`Episode ${episodeId} workflow complete, notifying API`);

      await axios
        .post(
          `${process.env.API_URL}/internal/episode/status`,
          { episodeId, status: 'ready', finalVideoUrl, thumbnailUrl },
          { headers: { 'x-internal-secret': process.env.INTERNAL_SECRET } },
        )
        .catch((e) => this.logger.error('Failed to notify API of completion', e.message));
    }
  }

  async handleNodeFailed(episodeId: string, nodeId: string, error: string) {
    await this.prisma.nodeRun.updateMany({
      where: { episodeId, nodeId },
      data: { status: 'failed', error, completedAt: new Date() },
    });

    this.logger.error(`Episode ${episodeId} node ${nodeId} failed: ${error}`);

    await axios
      .post(
        `${process.env.API_URL}/internal/episode/status`,
        { episodeId, status: 'failed' },
        { headers: { 'x-internal-secret': process.env.INTERNAL_SECRET } },
      )
      .catch(() => {});
  }
}
