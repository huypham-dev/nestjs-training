// Dependencies
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Inject, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';

// Common
import { BaseGateway, SocketClientData } from '@/common/gateways/base.gateway';

// Services
import type { IAuthService } from '@/shared/services';
import { AUTH_SERVICE } from '@/shared/services';

// Constants
import { UserRole, UserStatus, SocketEvents, SocketRooms } from '@/constants';

// Entities
import { User } from './user.entity';

export interface UserStatusChangedPayload {
  userId: string;
  status: UserStatus;
  changedAt: string;
}

@WebSocketGateway({
  namespace: '/users',
  cors: {
    origin: 'http://localhost:5173', // Configure based on your environment
  },
})
export class UserGateway extends BaseGateway {
  protected readonly logger = new Logger(UserGateway.name);

  constructor(
    @Inject(AUTH_SERVICE)
    authService: IAuthService
  ) {
    super(authService);
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
      .to(SocketRooms.USER_AUTH(user.authId))
      .emit(SocketEvents.USER_STATUS_CHANGED, payload);

    // Notify all admins
    this.server
      .to(SocketRooms.ADMINS)
      .emit(SocketEvents.USER_STATUS_CHANGED, payload);

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

    void client.join(SocketRooms.USER_AUTH(data.targetAuthId));
    this.logger.log(
      `Admin ${clientData.authId} subscribed to status of auth ${data.targetAuthId}`
    );

    client.emit('subscribed', { targetAuthId: data.targetAuthId });
  }
}
