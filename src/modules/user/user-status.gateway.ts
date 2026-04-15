// Dependencies
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Inject, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

// Services
import type { IAuthService } from '@/shared/services';
import { AUTH_SERVICE } from '@/shared/services';

// Constants
import { UserRole, UserStatus, SocketEvents } from '@/constants';

// Entities
import { User } from './user.entity';

export interface UserStatusChangedPayload {
  userId: string;
  status: UserStatus;
  changedAt: string;
}

// Shape stored in client.data after successful auth
interface SocketClientData {
  authId: string;
  role: UserRole;
}

@WebSocketGateway({
  namespace: '/users',
  cors: {
    origin: 'http://localhost:5173', // Configure based on your environment
  },
})
export class UserStatusGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(UserStatusGateway.name);

  constructor(
    @Inject(AUTH_SERVICE)
    private readonly authService: IAuthService
  ) {}

  afterInit() {
    this.logger.log('UserStatusGateway initialized (namespace: /users)');
  }

  /**
   * Handle new WebSocket connections
   * Client must send token in handshake auth:
   * e.g. io('/users', { auth: { token: 'Bearer eyJ...' } })
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

      // Verify token with Clerk → get authId
      const authId = await this.authService.verifyToken(token);

      // Get role from token claims
      const role = (client.handshake.auth?.role as UserRole) || UserRole.USER;

      // Store verified data in client.data
      (client.data as SocketClientData) = { authId, role };

      // Join personal room (authId-based, not userId)
      void client.join(`auth:${authId}`);

      // If admin, join admin room
      if (role === UserRole.ADMIN) {
        void client.join('admins');
      }

      this.logger.log(
        `Client connected: socketId=${client.id}, authId=${authId}, role=${role}`
      );
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
  }

  /**
   * Emit user status changed event to relevant clients
   * - The affected user (their personal room)
   * - All admins
   */
  emitUserStatusChanged(user: User): void {
    const payload: UserStatusChangedPayload = {
      userId: user.id,
      status: user.status as UserStatus,
      changedAt: new Date().toISOString(),
    };

    // Notify the affected user's personal room (via authId)
    this.server
      .to(`auth:${user.authId}`)
      .emit(SocketEvents.USER_STATUS_CHANGED, payload);

    // Notify all admins
    this.server.to('admins').emit(SocketEvents.USER_STATUS_CHANGED, payload);

    this.logger.log(
      `Emitted ${SocketEvents.USER_STATUS_CHANGED} for user ${user.id} → status: ${user.status}`
    );
  }

  /**
   * Allow admin to subscribe to a specific user's status changes
   */
  @SubscribeMessage('subscribe:user_status')
  handleSubscribeUserStatus(
    @MessageBody() data: { targetAuthId: string },
    @ConnectedSocket() client: Socket
  ) {
    const clientData = client.data as Partial<SocketClientData>;

    if (clientData?.role !== UserRole.ADMIN) {
      client.emit('error', {
        message: 'Only admins can subscribe to user status changes',
      });
      return;
    }

    void client.join(`auth:${data.targetAuthId}`);
    this.logger.log(
      `Admin ${clientData.authId} subscribed to status of auth ${data.targetAuthId}`
    );

    client.emit('subscribed', { targetAuthId: data.targetAuthId });
  }
}
