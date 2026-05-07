// Dependencies
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable, Logger } from '@nestjs/common';

// Common
import { ResourceNotFoundException } from '@/common/exceptions';

// Entities
import { DeviceToken } from './device-token.entity';

// DTOs
import type {
  RegisterDeviceDto,
  SendNotificationToUserDto,
  UnregisterDeviceDto,
} from './notification.dto';

// Queue
import { NotificationProducer } from './queues/notification.producer';

// User entity (for FK reference only)
import { User } from '@/modules/user/user.entity';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepo: EntityRepository<DeviceToken>,
    @InjectRepository(User)
    private readonly userRepo: EntityRepository<User>,
    private readonly em: EntityManager,
    private readonly notificationProducer: NotificationProducer
  ) {}

  /**
   * Register (or refresh) an FCM device token for the current user.
   * Upserts by token value so duplicate registrations are idempotent.
   */
  async registerDevice(
    userId: string,
    dto: RegisterDeviceDto
  ): Promise<DeviceToken> {
    // Check if token already exists (possibly for another user after reinstall)
    let deviceToken = await this.deviceTokenRepo.findOne({ token: dto.token });

    if (deviceToken) {
      // Re-associate with the current user and mark active
      deviceToken.user = this.em.getReference(User, userId);
      deviceToken.platform = dto.platform ?? deviceToken.platform;
      deviceToken.deviceName = dto.deviceName ?? deviceToken.deviceName;
      deviceToken.isActive = true;
    } else {
      deviceToken = this.deviceTokenRepo.create({
        user: userId,
        token: dto.token,
        platform: dto.platform,
        deviceName: dto.deviceName,
        isActive: true,
      });
    }

    await this.em.persist(deviceToken).flush();
    this.logger.log(`Registered device token for user ${userId}`);
    return deviceToken;
  }

  /**
   * Unregister a specific FCM token (e.g. on logout).
   */
  async unregisterDevice(
    userId: string,
    dto: UnregisterDeviceDto
  ): Promise<void> {
    const deviceToken = await this.deviceTokenRepo.findOne({
      token: dto.token,
      user: userId,
    });

    if (!deviceToken) {
      throw new ResourceNotFoundException(
        `Device token not found for the current user`
      );
    }

    this.em.remove(deviceToken);
    await this.em.flush();
    this.logger.log(`Unregistered device token for user ${userId}`);
  }

  /**
   * List all active device tokens registered by a user.
   */
  async getDeviceTokensByUser(userId: string): Promise<DeviceToken[]> {
    return this.deviceTokenRepo.find({ user: userId, isActive: true });
  }

  /**
   * Dispatch a push notification to all active devices of a user.
   * Enqueues the delivery job and returns immediately (non-blocking).
   */
  async sendPushNotification(dto: SendNotificationToUserDto): Promise<void> {
    // Ensure the user exists
    const userExists = await this.userRepo.count({ id: dto.userId });
    if (!userExists) {
      throw new ResourceNotFoundException(
        `User with ID '${dto.userId}' not found`
      );
    }

    // Resolve active device tokens
    const deviceTokens = await this.deviceTokenRepo.find({
      user: dto.userId,
      isActive: true,
    });

    if (deviceTokens.length === 0) {
      this.logger.warn(`No active device tokens for user ${dto.userId}`);
      return;
    }

    // Enqueue the job (non-blocking)
    await this.notificationProducer.enqueuePushNotification({
      userId: dto.userId,
      tokens: deviceTokens.map((dt) => dt.token),
      payload: {
        title: dto.title,
        body: dto.body,
        data: dto.data,
        imageUrl: dto.imageUrl,
      },
    });
  }
}
