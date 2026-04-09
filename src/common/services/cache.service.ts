// Dependencies
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';

// Constants
import { CACHE_KEYS } from '@/constants';

/**
 * Cache Service for centralized cache management
 * Handles cache invalidation patterns for different entities
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private cacheKeys = new Set<string>(); // Track all cache keys

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Track a cache key (called by HttpCacheInterceptor)
   */
  trackKey(key: string): void {
    this.cacheKeys.add(key);
  }

  /**
   * Get all tracked cache keys
   */
  getTrackedKeys(): string[] {
    return Array.from(this.cacheKeys);
  }

  /**
   * Invalidate all post-related caches
   */
  async invalidatePostCaches(): Promise<void> {
    // Invalidate HTTP cache created by HttpCacheInterceptor
    // This clears all cache entries for posts endpoints
    await this.invalidateHttpCache('/posts');
    await this.invalidateHttpCache(`/users/`); // For /users/:id/posts
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

  /**
   * Invalidate all HTTP cache entries matching a URL pattern
   * This clears cache created by HttpCacheInterceptor (format: {url}:user:{userId})
   *
   * @param urlPattern - URL pattern to match (e.g., '/posts')
   */
  async invalidateHttpCache(urlPattern: string): Promise<void> {
    const trackedKeys = this.getTrackedKeys();
    const matchingKeys = trackedKeys.filter((key) => key.includes(urlPattern));

    this.logger.debug(
      `Invalidating ${matchingKeys.length} cache entries matching pattern: ${urlPattern}`
    );

    // Delete all matching keys
    await Promise.all(
      matchingKeys.map(async (key) => {
        await this.cacheManager.del(key);
        this.cacheKeys.delete(key); // Remove from tracked keys
      })
    );
  }
}
