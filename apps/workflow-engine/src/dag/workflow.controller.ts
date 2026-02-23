import { Controller, Post, Body, Headers, UnauthorizedException, Get } from '@nestjs/common';
import { WorkflowService } from './workflow.service';

@Controller()
export class WorkflowController {
  constructor(private workflowService: WorkflowService) {}

  private checkSecret(secret: string) {
    if (secret !== process.env.INTERNAL_SECRET) throw new UnauthorizedException();
  }

  @Post('workflow/start')
  async startWorkflow(
    @Headers('x-internal-secret') secret: string,
    @Body() body: { episodeId: string; workflow: any; workflowVersion: number },
  ) {
    this.checkSecret(secret);
    return this.workflowService.startWorkflow(body.episodeId, body.workflow, body.workflowVersion);
  }

  @Post('internal/workflow/node-complete')
  async nodeComplete(
    @Headers('x-internal-secret') secret: string,
    @Body() body: { episodeId: string; nodeId: string; output: any; workflow: any },
  ) {
    this.checkSecret(secret);
    return this.workflowService.handleNodeComplete(
      body.episodeId,
      body.nodeId,
      body.output,
      body.workflow,
    );
  }

  @Post('internal/workflow/node-failed')
  async nodeFailed(
    @Headers('x-internal-secret') secret: string,
    @Body() body: { episodeId: string; nodeId: string; error: string },
  ) {
    this.checkSecret(secret);
    return this.workflowService.handleNodeFailed(body.episodeId, body.nodeId, body.error);
  }

  @Get('health')
  health() {
    return { status: 'ok', service: 'workflow-engine' };
  }
}
