import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

export type FamilyEvent =
  | 'member:created'
  | 'member:updated'
  | 'member:deleted'
  | 'marriage:created'
  | 'marriage:updated'
  | 'marriage:deleted'
  | 'layout:synced'
  | 'avatar:updated';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class FamilyGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private clientCount = 0;

  handleConnection(_client: Socket) {
    this.clientCount++;
  }

  handleDisconnect(_client: Socket) {
    this.clientCount = Math.max(0, this.clientCount - 1);
  }

  broadcast(event: FamilyEvent, data: unknown) {
    this.server?.emit(event, data);
  }
}
