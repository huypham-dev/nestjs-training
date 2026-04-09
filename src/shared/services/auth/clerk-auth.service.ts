// Dependencies
import { createClerkClient, WebhookEvent } from '@clerk/backend';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Webhook } from 'svix';

// Interfaces
import type { IAuthService, WebhookEventData } from './auth-service.interface';

/**
 * Clerk Authentication Service Implementation
 *
 * Implements IAuthService using Clerk as the authentication provider.
 * To switch to another provider (Auth0, Firebase, etc.), create a new
 * implementation of IAuthService and update the provider in shared.module.ts
 */
@Injectable()
export class ClerkAuthService implements IAuthService {
  private readonly logger = new Logger(ClerkAuthService.name);
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
   * Verify Clerk webhook signature using Svix
   * @param payload - Raw webhook payload string
   * @param headers - Object containing svix-id, svix-timestamp, svix-signature
   * @returns Verified webhook event data
   * @throws Error if verification fails
   */
  verifyWebhook(
    payload: string,
    headers: Record<string, string>
  ): WebhookEventData {
    if (!this.webhookSecret) {
      throw new Error('CLERK_WEBHOOK_SECRET is not configured');
    }

    try {
      const wh = new Webhook(this.webhookSecret);
      const event = wh.verify(payload, {
        'svix-id': headers['svix-id'],
        'svix-timestamp': headers['svix-timestamp'],
        'svix-signature': headers['svix-signature'],
      }) as WebhookEvent;

      // Convert Clerk-specific event to generic structure
      return {
        type: event.type,
        data: event.data as Record<string, any>,
      };
    } catch (error) {
      this.logger.error('Webhook verification failed:', error);
      throw new Error('Invalid webhook signature');
    }
  }

  /**
   * Lock user account on Clerk
   * Prevents user from signing in
   */
  async lockUser(authId: string): Promise<void> {
    try {
      await this.clerkClient.users.lockUser(authId);
      this.logger.log(`Successfully locked Clerk user ${authId}`);
    } catch (error) {
      this.logger.error(`Failed to lock Clerk user ${authId}:`, error);
      throw new Error('Failed to lock user on Clerk');
    }
  }

  /**
   * Unlock user account on Clerk
   * Allows user to sign in again
   */
  async unlockUser(authId: string): Promise<void> {
    try {
      await this.clerkClient.users.unlockUser(authId);
      this.logger.log(`Successfully unlocked Clerk user ${authId}`);
    } catch (error) {
      this.logger.error(`Failed to unlock Clerk user ${authId}:`, error);
      throw new Error('Failed to unlock user on Clerk');
    }
  }
}
