/**
 * No-Op Cache Interceptor for E2E Tests
 * Bypasses caching to ensure tests have fresh data
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class NoOpCacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Simply pass through without caching
    return next.handle();
  }
}
