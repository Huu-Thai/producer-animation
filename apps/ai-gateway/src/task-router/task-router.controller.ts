import { Controller, Post, Body, Headers, UnauthorizedException, Get } from '@nestjs/common';
import { TaskRouterService } from './task-router.service';

@Controller()
export class TaskRouterController {
  constructor(private taskRouterService: TaskRouterService) {}

  private checkSecret(secret: string) {
    if (secret !== process.env.INTERNAL_SECRET) throw new UnauthorizedException();
  }

  @Post('tasks/execute')
  async executeTask(
    @Headers('x-internal-secret') secret: string,
    @Body()
    body: {
      episodeId: string;
      nodeId: string;
      nodeType: string;
      config: any;
      inputs: any;
    },
  ) {
    this.checkSecret(secret);
    return this.taskRouterService.executeTask(
      body.episodeId,
      body.nodeId,
      body.nodeType,
      body.config ?? {},
      body.inputs ?? {},
    );
  }

  @Get('health')
  health() {
    return { status: 'ok', service: 'ai-gateway' };
  }
}
