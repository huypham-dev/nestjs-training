// Dependencies
import { createClerkClient, WebhookEvent } from '@clerk/backend';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Webhook } from 'svix';

@Injectable()
export class ClerkService {
  private readonly logger = new Logger(ClerkService.name);
  private clerkClient: ReturnType<typeof createClerkClient>;
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.clerkClient = createClerkClient({
      secretKey: this.configService.get<string>('CLERK_SECRET_KEY'),
    });

    this.webhookSecret =
      this.configService.get<string>('CLERK_WEBHOOK_SECRET') || '';
    if (!this.webhookSecret) {
      this.logger.warn('CLERK_WEBHOOK_SECRET not configured');
    }
  }

  /**
   * Verify Clerk webhook signature
   * @throws Error if verification fails
   */
  verifyWebhook(
    payload: string,
    svixId: string,
    svixTimestamp: string,
    svixSignature: string
  ): WebhookEvent {
    if (!this.webhookSecret) {
      throw new Error('CLERK_WEBHOOK_SECRET is not configured');
    }

    try {
      const wh = new Webhook(this.webhookSecret);
      return wh.verify(payload, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as WebhookEvent;
    } catch (error) {
      this.logger.error('Webhook verification failed:', error);
      throw new Error('Invalid webhook signature');
    }
  }

  /**
   * Lock user account on Clerk
   * Prevents user from signing in
   */
  async lockUser(clerkUserId: string): Promise<void> {
    try {
      await this.clerkClient.users.lockUser(clerkUserId);
      this.logger.log(`Successfully locked Clerk user ${clerkUserId}`);
    } catch (error) {
      this.logger.error(`Failed to lock Clerk user ${clerkUserId}:`, error);
      throw new Error('Failed to lock user on Clerk');
    }
  }

  /**
   * Unlock user account on Clerk
   * Allows user to sign in again
   */
  async unlockUser(clerkUserId: string): Promise<void> {
    try {
      await this.clerkClient.users.unlockUser(clerkUserId);
      this.logger.log(`Successfully unlocked Clerk user ${clerkUserId}`);
    } catch (error) {
      this.logger.error(`Failed to unlock Clerk user ${clerkUserId}:`, error);
      throw new Error('Failed to unlock user on Clerk');
    }
  }
}
