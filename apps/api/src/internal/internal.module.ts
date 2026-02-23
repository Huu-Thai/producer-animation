import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [WebSocketModule],
  controllers: [InternalController],
})
export class InternalModule {}
