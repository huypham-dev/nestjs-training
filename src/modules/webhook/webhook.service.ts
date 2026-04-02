import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Webhook } from 'svix';
import { WebhookEvent } from '@clerk/backend';
import { UserService } from '../user/user.service';
import { UserStatus } from '../../constants/users';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService
  ) {
    this.webhookSecret =
      this.configService.get<string>('CLERK_WEBHOOK_SECRET') || '';
    if (!this.webhookSecret) {
      this.logger.warn('CLERK_WEBHOOK_SECRET not configured');
    }
  }

  async verifyAndProcess(
    payload: string,
    svixId: string,
    svixTimestamp: string,
    svixSignature: string
  ): Promise<void> {
    if (!this.webhookSecret) {
      throw new Error('CLERK_WEBHOOK_SECRET is not configured');
    }

    // Verify the webhook signature
    const wh = new Webhook(this.webhookSecret);
    let event: WebhookEvent;

    try {
      event = wh.verify(payload, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as WebhookEvent;
    } catch (error) {
      this.logger.error('Webhook verification failed:', error);
      throw error;
    }

    this.logger.log(`Verified webhook event: ${event.type}`);

    // Process the event
    await this.processEvent(event);
  }

  private async processEvent(event: WebhookEvent): Promise<void> {
    switch (event.type) {
      case 'user.updated':
        await this.handleUserUpdated(event);
        break;
      case 'user.created':
        this.logger.log(`User created: ${event.data.id}`);
        // Handle user creation if needed
        break;
      case 'user.deleted':
        this.logger.log(`User deleted: ${event.data.id}`);
        // Handle user deletion if needed
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handleUserUpdated(event: WebhookEvent): Promise<void> {
    try {
      if (event.type !== 'user.updated') {
        return;
      }

      const { id: authId, locked } = event.data;

      if (!authId || typeof authId !== 'string') {
        this.logger.warn('User updated event missing authId');
        return;
      }

      this.logger.log(
        `Processing user.updated for authId: ${authId}, locked: ${locked}`
      );

      // Find user by authId
      const user = await this.userService.getUserByAuthId(authId);

      if (!user) {
        this.logger.warn(`User not found with authId: ${authId}`);
        return;
      }

      // Determine the new status based on locked field
      const newStatus: UserStatus = locked
        ? UserStatus.INACTIVE
        : UserStatus.ACTIVE;

      // Update user status if it has changed
      if (String(user.status) !== String(newStatus)) {
        await this.userService.updateUserStatusFromWebhook(user.id, newStatus);
        this.logger.log(
          `Successfully updated user ${user.id} status to ${newStatus}`
        );
      } else {
        this.logger.log(
          `User ${user.id} status already ${newStatus}, no update needed`
        );
      }
    } catch (error) {
      this.logger.error('Error handling user.updated event:', error);
      throw error;
    }
  }
}
