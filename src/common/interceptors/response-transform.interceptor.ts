// Dependencies
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Interfaces
import { SuccessResponse } from '../interfaces/response.interface';

/**
 * Interceptor to transform successful responses into standardized format
 * Only applies to responses that are not already in the standard format
 * Errors are passed through to be handled by GlobalExceptionFilter
 */
@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<
  T,
  SuccessResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<SuccessResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        if (this.isAlreadyFormatted(data)) {
          return data;
        }

        return { data };
      })
    );
  }

  private isAlreadyFormatted(data: unknown): data is SuccessResponse<T> {
    return (
      typeof data === 'object' &&
      data !== null &&
      ('status' in data || 'data' in data)
    );
  }
}
