import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:episode')
  handleJoin(@MessageBody() episodeId: string, @ConnectedSocket() client: Socket) {
    client.join(`episode:${episodeId}`);
    this.logger.log(`Client ${client.id} joined episode:${episodeId}`);
    return { joined: episodeId };
  }

  @SubscribeMessage('leave:episode')
  handleLeave(@MessageBody() episodeId: string, @ConnectedSocket() client: Socket) {
    client.leave(`episode:${episodeId}`);
    return { left: episodeId };
  }

  emitEpisodeStatus(episodeId: string, status: string) {
    this.server.to(`episode:${episodeId}`).emit('episode:status', { episodeId, status });
  }

  emitNodeStatus(episodeId: string, nodeId: string, status: string, output?: any) {
    this.server
      .to(`episode:${episodeId}`)
      .emit('node:status', { episodeId, nodeId, status, output });
  }

  emitEpisodeReady(episodeId: string, videoUrl: string, thumbnailUrl: string) {
    this.server
      .to(`episode:${episodeId}`)
      .emit('episode:ready', { episodeId, videoUrl, thumbnailUrl });
  }

  emitEpisodePublished(episodeId: string, platformVideoId: string) {
    this.server
      .to(`episode:${episodeId}`)
      .emit('episode:published', { episodeId, platformVideoId });
  }

  emitEpisodeError(episodeId: string, error: string) {
    this.server.to(`episode:${episodeId}`).emit('episode:error', { episodeId, error });
  }
}
