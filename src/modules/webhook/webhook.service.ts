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
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handleUserUpdated(event: WebhookEvent): Promise<void> {
    try {
      if (event.type !== 'user.updated') {
        return;
      }

      const { id: authId, locked, image_url } = event.data;

      if (!authId || typeof authId !== 'string') {
        this.logger.warn('User updated event missing authId');
        return;
      }

      this.logger.log(
        `Processing user.updated for authId: ${authId}, locked: ${locked}, avatarUrl: ${image_url}`
      );

      // Find user by authId
      const user = await this.userService.getUserByAuthId(authId);

      if (!user) {
        this.logger.warn(`User not found with authId: ${authId}`);
        return;
      }

      // Prepare updates
      const updates: Partial<{ status: UserStatus; avatarUrl: string }> = {};

      // Determine the new status based on locked field
      const newStatus: UserStatus = locked
        ? UserStatus.INACTIVE
        : UserStatus.ACTIVE;

      if (String(user.status) !== String(newStatus)) {
        updates.status = newStatus;
      }

      // Update avatarUrl if it has changed
      if (image_url && user.avatarUrl !== image_url) {
        updates.avatarUrl = image_url;
      }

      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        await this.userService.updateUserFromWebhook(user.id, updates);
        this.logger.log(
          `Successfully updated user ${user.id}: ${JSON.stringify(updates)}`
        );
      } else {
        this.logger.log(`User ${user.id} data unchanged, no update needed`);
      }
    } catch (error) {
      this.logger.error('Error handling user.updated event:', error);
      throw error;
    }
  }
}
