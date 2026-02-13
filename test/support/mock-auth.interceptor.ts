/**
 * Mock Authentication Interceptor for E2E Tests
 * Injects test user into request context
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { MockAuthUser } from 'test/helpers/auth.helper';

@Injectable()
export class MockAuthInterceptor implements NestInterceptor {
  private static mockUser: MockAuthUser | null = null;

  /**
   * Set the mock user for the next request
   */
  static setMockUser(user: MockAuthUser | null) {
    MockAuthInterceptor.mockUser = user;
  }

  /**
   * Get current mock user
   */
  static getMockUser(): MockAuthUser | null {
    return MockAuthInterceptor.mockUser;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const mockUser = MockAuthInterceptor.mockUser;

    if (mockUser) {
      // Inject auth data
      request.auth = {
        authId: mockUser.authId,
        email: mockUser.email,
        fullName: mockUser.fullName,
      };

      // Inject user data (simulating database lookup)
      request.user = {
        id: mockUser.authId,
        authId: mockUser.authId,
        email: mockUser.email,
        fullName: mockUser.fullName,
        role: mockUser.role,
        status: mockUser.status,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return next.handle();
  }
}
