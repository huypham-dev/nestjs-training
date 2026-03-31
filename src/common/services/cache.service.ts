import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { CACHE_KEYS } from '@/constants';

/**
 * Cache Service for centralized cache management
 * Handles cache invalidation patterns for different entities
 */
@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Invalidate all user-related caches
   */
  async invalidateUserCaches(userId?: string): Promise<void> {
    const patterns = [
      CACHE_KEYS.USERS_LIST, // All users list cache
      userId ? CACHE_KEYS.USER_DETAIL(userId) : null, // Specific user cache
      userId ? CACHE_KEYS.USER_POSTS(userId) : null, // User's posts cache
    ].filter(Boolean) as string[];

    await this.invalidateByPatterns(patterns);
  }

  /**
   * Invalidate all post-related caches
   */
  async invalidatePostCaches(postId?: string, userId?: string): Promise<void> {
    const patterns = [
      CACHE_KEYS.POSTS_LIST, // All posts list cache
      postId ? CACHE_KEYS.POST_DETAIL(postId) : null, // Specific post cache
      userId ? CACHE_KEYS.USER_POSTS(userId) : null, // User's posts cache
    ].filter(Boolean) as string[];

    await this.invalidateByPatterns(patterns);
  }

  /**
   * Invalidate all category-related caches
   */
  async invalidateCategoryCaches(): Promise<void> {
    const patterns = [CACHE_KEYS.CATEGORIES_LIST, CACHE_KEYS.POSTS_LIST]; // Categories affect post lists too
    await this.invalidateByPatterns(patterns);
  }

  /**
   * Invalidate cache by specific key
   */
  async invalidate(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  /**
   * Invalidate cache by pattern (simplified - cache-manager doesn't support patterns natively)
   * For production, consider using Redis with pattern matching
   */
  private async invalidateByPatterns(patterns: string[]): Promise<void> {
    // Note: In-memory cache doesn't support pattern deletion
    // For production with Redis, use: client.keys(pattern) then delete
    // For now, we'll delete known keys
    for (const pattern of patterns) {
      if (!pattern.includes('*')) {
        await this.cacheManager.del(pattern);
      }
      // For patterns with *, you'd need to track keys or use Redis SCAN
    }
  }
}
