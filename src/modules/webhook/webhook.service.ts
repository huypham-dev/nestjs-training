// Dependencies
import { WebhookEvent } from '@clerk/backend';
import { Injectable, Logger } from '@nestjs/common';

// Services
import { ClerkService } from '@/shared/services';
import { UserService } from '../user/user.service';

// Constants
import { UserStatus, CLERK_WEBHOOK_EVENTS } from '@/constants';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly clerkService: ClerkService,
    private readonly userService: UserService
  ) {}

  async verifyAndProcess(
    payload: string,
    svixId: string,
    svixTimestamp: string,
    svixSignature: string
  ): Promise<void> {
    // Verify webhook signature using ClerkService
    const event = this.clerkService.verifyWebhook(
      payload,
      svixId,
      svixTimestamp,
      svixSignature
    );

    this.logger.log(`Verified webhook event: ${event.type}`);

    // Process the event
    await this.processEvent(event);
  }

  private async processEvent(event: WebhookEvent): Promise<void> {
    switch (event.type) {
      case CLERK_WEBHOOK_EVENTS.USER_UPDATED:
        await this.handleUserUpdated(event);
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handleUserUpdated(event: WebhookEvent): Promise<void> {
    try {
      if (event.type !== CLERK_WEBHOOK_EVENTS.USER_UPDATED) {
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
