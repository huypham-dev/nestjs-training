// Dependencies
import { Inject, Injectable, Logger } from '@nestjs/common';

// Services
import type { IAuthService, WebhookEventData } from '@/shared/services';
import { AUTH_SERVICE } from '@/shared/services';
import { UserService } from '../user/user.service';

// DTOs
import { createUserSchema } from '../user/user.dto';

// Constants
import { UserStatus, CLERK_WEBHOOK_EVENTS } from '@/constants';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @Inject(AUTH_SERVICE)
    private readonly authService: IAuthService,
    private readonly userService: UserService
  ) {}

  async verifyAndProcess(
    payload: string,
    svixId: string,
    svixTimestamp: string,
    svixSignature: string
  ): Promise<void> {
    // Verify webhook signature using Auth Service
    const event = this.authService.verifyWebhook(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    });

    this.logger.log(`Verified webhook event: ${event.type}`);

    // Process the event
    await this.processEvent(event);
  }

  private async processEvent(event: WebhookEventData): Promise<void> {
    switch (event.type) {
      case CLERK_WEBHOOK_EVENTS.USER_CREATED:
        await this.handleUserCreated(event);
        break;
      case CLERK_WEBHOOK_EVENTS.USER_UPDATED:
        await this.handleUserUpdated(event);
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Handle user.created webhook event
   *
   * Creates a new user in the database when a user signs up through the auth provider.
   * This replaces the syncUser middleware approach by handling user creation
   * explicitly through webhook events for better reliability and control.
   *
   * @param event - Webhook event with user.created type
   * @throws Error if user creation fails (triggers webhook retry)
   */
  private async handleUserCreated(event: WebhookEventData): Promise<void> {
    try {
      if (event.type !== CLERK_WEBHOOK_EVENTS.USER_CREATED) {
        return;
      }

      const {
        id: authId,
        email_addresses: emailAddresses,
        first_name: firstName,
        last_name: lastName,
        image_url: imageUrl,
        primary_email_address_id: primaryEmailAddressId,
      } = event.data;

      if (!authId || typeof authId !== 'string') {
        this.logger.warn('User created event missing authId');
        return;
      }

      // Get primary email
      const primaryEmail = emailAddresses?.find(
        (e: any) => e.id === primaryEmailAddressId
      );
      const email = primaryEmail?.email_address || '';

      // Construct full name
      const fullName = [firstName, lastName].filter(Boolean).join(' ');

      this.logger.log(
        `Processing user.created for authId: ${authId}, email: ${email}, fullName: ${fullName}`
      );

      // Validate and create user data
      const userData = createUserSchema.parse({
        authId,
        email,
        fullName,
        avatarUrl: imageUrl,
      });

      // Create user in database
      await this.userService.createUser(userData);

      this.logger.log(
        `Successfully processed user.created for authId: ${authId}`
      );
    } catch (error) {
      this.logger.error('Error handling user.created event:', error);
      throw error;
    }
  }

  private async handleUserUpdated(event: WebhookEventData): Promise<void> {
    try {
      if (event.type !== CLERK_WEBHOOK_EVENTS.USER_UPDATED) {
        return;
      }

      const { id: authId, locked, image_url: imageUrl } = event.data;

      if (!authId || typeof authId !== 'string') {
        this.logger.warn('User updated event missing authId');
        return;
      }

      this.logger.log(
        `Processing user.updated for authId: ${authId}, locked: ${locked}, avatarUrl: ${imageUrl}`
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
      if (imageUrl && user.avatarUrl !== imageUrl) {
        updates.avatarUrl = imageUrl;
      }

      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        await this.userService.updateUser(user.id, updates);
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
