/**
 * Authentication Service Interface
 *
 * Abstract interface for authentication provider operations.
 * Implementations: ClerkAuthService, Auth0Service, FirebaseAuthService, etc.
 */

/**
 * Dependency Injection Token
 * Use this token to inject the auth service
 */
export const AUTH_SERVICE = Symbol('AUTH_SERVICE');

/**
 * Webhook event data structure
 * Generic structure that can be adapted by different providers
 */
export interface WebhookEventData {
  type: string;
  data: Record<string, any>;
}

/**
 * Authentication Service Interface
 */
export interface IAuthService {
  /**
   * Verify webhook signature from auth provider
   * @param payload - Raw webhook payload
   * @param headers - Webhook headers for signature verification
   * @returns Verified webhook event data
   * @throws Error if verification fails
   */
  verifyWebhook(
    payload: string,
    headers: Record<string, string>
  ): WebhookEventData;

  /**
   * Lock/disable user account on auth provider
   * Prevents user from signing in
   * @param authId - User's authentication ID from provider
   */
  lockUser(authId: string): Promise<void>;

  /**
   * Unlock/enable user account on auth provider
   * Allows user to sign in again
   * @param authId - User's authentication ID from provider
   */
  unlockUser(authId: string): Promise<void>;
}
