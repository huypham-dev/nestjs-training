// Dependencies
import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  CACHE_MANAGER,
  CacheInterceptor,
  CACHE_KEY_METADATA,
} from '@nestjs/cache-manager';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import type { Cache } from 'cache-manager';
import { CacheService } from '@/common/services';

/**
 * Custom HTTP Cache Interceptor
 *
 * Extends the default CacheInterceptor to include user context in cache keys.
 * This ensures that different users get different cached responses for the same endpoint.
 * Also tracks cache keys for invalidation purposes.
 *
 * Cache key format: `{url}:user:{userId}`
 *
 * @example
 * GET /api/v1/posts?limit=10 by user-123
 * → Cache key: /api/v1/posts?limit=10:user:user-123
 */
@Injectable()
export class HttpCacheInterceptor extends CacheInterceptor {
  constructor(
    @Inject(CACHE_MANAGER) cacheManager: Cache,
    reflector: Reflector,
    @Inject(CacheService) private cacheService: CacheService
  ) {
    super(cacheManager, reflector);
  }

  /**
   * Intercept request to track cache keys
   */
  async intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Promise<Observable<any>> {
    const cacheKey = this.trackBy(context);

    // Track the cache key for later invalidation
    if (cacheKey) {
      this.cacheService.trackKey(cacheKey);
    }

    const result = await super.intercept(context, next);

    return result.pipe(
      tap(() => {
        // Ensure cache key is tracked after response is cached
        if (cacheKey) {
          this.cacheService.trackKey(cacheKey);
        }
      })
    );
  }

  /**
   * Generate custom cache key that includes user context
   *
   * @param context - Execution context containing request and user info
   * @returns Custom cache key string
   */
  trackBy(context: ExecutionContext): string | undefined {
    const request = context.switchToHttp().getRequest();
    const { httpAdapter } = this.httpAdapterHost;

    // Check for custom cache key from @CacheKey decorator
    const cacheKey = this.reflector.get(
      CACHE_KEY_METADATA,
      context.getHandler()
    );

    if (cacheKey) {
      // If custom cache key is provided, use it with user context
      const user = request.user;
      return user ? `${cacheKey}:user:${user.id}` : cacheKey;
    }

    // For non-cacheable requests (non-GET), return undefined
    const isGetRequest = httpAdapter.getRequestMethod(request) === 'GET';
    if (!isGetRequest) {
      return undefined;
    }

    // Build cache key from: method + url + user
    const url = httpAdapter.getRequestUrl(request);
    const user = request.user;

    // Include user ID in cache key to prevent cache collision between users
    // Different users should have different cache entries for personalized content
    if (user?.id) {
      return `${url}:user:${user.id}`;
    }

    // Fallback to URL-only cache key for unauthenticated requests
    return url;
  }
}
