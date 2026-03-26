/**
 * Cache Key Constants
 * Centralized management of all cache keys used throughout the application
 */

// List cache keys
export const CACHE_KEYS = {
  // User-related cache keys
  USERS_LIST: 'users_list',
  USER_DETAIL: (userId: string) => `user_${userId}`,
  USER_ME: (authId: string) => `user_me_${authId}`,
  USER_POSTS: (userId: string) => `user_posts_${userId}`,

  // Post-related cache keys
  POSTS_LIST: 'posts_list',
  POST_DETAIL: (postId: string) => `post_${postId}`,

  // Category-related cache keys
  CATEGORIES_LIST: 'categories_list',
} as const;

// Cache key patterns for invalidation
export const CACHE_PATTERNS = {
  USERS_LIST_ALL: 'users_list_*',
  USER_POSTS_ALL: (userId: string) => `user_posts_${userId}_*`,
  POSTS_LIST_ALL: 'posts_list_*',
} as const;
