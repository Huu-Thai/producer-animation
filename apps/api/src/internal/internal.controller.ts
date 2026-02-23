import { Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { EventsGateway } from '../websocket/events.gateway';

@Controller('internal')
export class InternalController {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
  ) {}

  private checkSecret(secret: string) {
    if (secret !== process.env.INTERNAL_SECRET) {
      throw new UnauthorizedException('Invalid internal secret');
    }
  }

  @Post('episode/status')
  async updateEpisodeStatus(
    @Headers('x-internal-secret') secret: string,
    @Body()
    body: {
      episodeId: string;
      status: string;
      finalVideoUrl?: string;
      thumbnailUrl?: string;
    },
  ) {
    this.checkSecret(secret);
    const episode = await this.prisma.episode.update({
      where: { id: body.episodeId },
      data: {
        status: body.status,
        ...(body.finalVideoUrl ? { finalVideoUrl: body.finalVideoUrl } : {}),
        ...(body.thumbnailUrl ? { thumbnailUrl: body.thumbnailUrl } : {}),
      },
    });

    this.events.emitEpisodeStatus(body.episodeId, body.status);

    if (body.status === 'ready' && body.finalVideoUrl) {
      this.events.emitEpisodeReady(body.episodeId, body.finalVideoUrl, body.thumbnailUrl ?? '');
    }

    if (body.status === 'failed') {
      this.events.emitEpisodeError(body.episodeId, 'Episode processing failed');
    }

    return episode;
  }

  @Post('node/status')
  async updateNodeStatus(
    @Headers('x-internal-secret') secret: string,
    @Body()
    body: {
      episodeId: string;
      nodeId: string;
      status: string;
      output?: any;
      error?: string;
    },
  ) {
    this.checkSecret(secret);
    await this.prisma.nodeRun.updateMany({
      where: { episodeId: body.episodeId, nodeId: body.nodeId },
      data: {
        status: body.status,
        ...(body.output ? { output: body.output } : {}),
        ...(body.error ? { error: body.error } : {}),
        ...(body.status === 'running' ? { startedAt: new Date() } : {}),
        ...(body.status === 'completed' || body.status === 'failed'
          ? { completedAt: new Date() }
          : {}),
      },
    });

    this.events.emitNodeStatus(body.episodeId, body.nodeId, body.status, body.output);
    return { success: true };
  }

  @Post('publish')
  async updatePublish(
    @Headers('x-internal-secret') secret: string,
    @Body()
    body: {
      episodeId: string;
      channelId: string;
      platformVideoId: string;
      status: string;
    },
  ) {
    this.checkSecret(secret);
    await this.prisma.episodePublication.create({
      data: {
        episodeId: body.episodeId,
        channelId: body.channelId,
        platformVideoId: body.platformVideoId,
        status: body.status,
        publishedAt: body.status === 'published' ? new Date() : null,
      },
    });

    if (body.status === 'published') {
      await this.prisma.episode.update({
        where: { id: body.episodeId },
        data: { status: 'public' },
      });
      this.events.emitEpisodePublished(body.episodeId, body.platformVideoId);
    }

    return { success: true };
  }
}
