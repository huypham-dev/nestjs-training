// Dependencies
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';

@Injectable()
export class ClerkService {
  private clerkClient: ReturnType<typeof createClerkClient>;

  constructor(private readonly configService: ConfigService) {
    this.clerkClient = createClerkClient({
      secretKey: this.configService.get<string>('CLERK_SECRET_KEY'),
    });
  }

  /**
   * Lock user account on Clerk
   * Prevents user from signing in
   */
  async lockUser(clerkUserId: string): Promise<void> {
    try {
      await this.clerkClient.users.lockUser(clerkUserId);
    } catch (error) {
      console.error(`Failed to lock Clerk user ${clerkUserId}:`, error);
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
    } catch (error) {
      console.error(`Failed to unlock Clerk user ${clerkUserId}:`, error);
      throw new Error('Failed to unlock user on Clerk');
    }
  }
}
