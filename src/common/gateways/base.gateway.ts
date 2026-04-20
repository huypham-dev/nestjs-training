// Dependencies
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

// Services
import type { IAuthService } from '@/shared/services';

// Constants
import { UserRole, SocketRooms } from '@/constants';

// Shape stored in client.data after successful auth
export interface SocketClientData {
  authId: string;
  role: UserRole;
}

export abstract class BaseGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  protected abstract readonly logger: Logger;

  constructor(protected readonly authService: IAuthService) {}

  afterInit() {
    this.logger.log(`${this.constructor.name} initialized`);
  }

  /**
   * Handle new WebSocket connections
   * Client must send token in handshake auth:
   * e.g. io('/namespace', { auth: { token: 'Bearer eyJ...' } })
   */
  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization as string);

      if (!token) {
        client.emit('error', { message: 'Unauthorized: missing token' });
        client.disconnect();
        return;
      }

      // Verify token → get authId
      const authId = await this.authService.verifyToken(token);

      // Get role from token claims
      const role = (client.handshake.auth?.role as UserRole) || UserRole.USER;

      // Store verified data in client.data
      (client.data as SocketClientData) = { authId, role };

      // Join personal room (authId-based)
      void client.join(SocketRooms.USER_AUTH(authId));

      // If admin, join admin room
      if (role === UserRole.ADMIN) {
        void client.join(SocketRooms.ADMINS);
      }

      this.logger.log(
        `Client connected: socketId=${client.id}, authId=${authId}, role=${role}`
      );

      // Allow subclasses to run additional logic on connection
      await this.onClientConnected(client, { authId, role });
    } catch (error) {
      this.logger.error('Client connection failed authentication', error);
      client.emit('error', { message: 'Unauthorized: invalid token' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const data = client.data as Partial<SocketClientData>;
    this.logger.log(
      `Client disconnected: socketId=${client.id}, authId=${data?.authId}`
    );

    // Allow subclasses to run additional logic on disconnection
    this.onClientDisconnected(client, data);
  }

  /**
   * Hook for subclasses to handle additional connection logic
   * Override this method to add custom behavior after authentication
   */
  protected onClientConnected(
    client: Socket,
    data: SocketClientData
  ): void | Promise<void> {
    void client;
    void data;
  }

  /**
   * Hook for subclasses to handle additional disconnection logic
   */
  protected onClientDisconnected(
    client: Socket,
    data: Partial<SocketClientData>
  ): void {
    void client;
    void data;
  }
}
