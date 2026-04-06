/**
 * Clerk Webhook Event Types
 * @see https://clerk.com/docs/integrations/webhooks/overview
 */
export const CLERK_WEBHOOK_EVENTS = {
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
} as const;
