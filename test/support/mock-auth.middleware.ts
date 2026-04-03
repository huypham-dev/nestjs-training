/**
 * Mock Authentication Middleware for E2E Tests
 * Replaces Clerk middleware and injects test user data
 */

// Dependencies
import { EntityManager } from '@mikro-orm/core';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

// Modules
import { User } from '@/modules/user/user.entity';

// Interceptors
import { MockAuthInterceptor } from './mock-auth.interceptor';

@Injectable()
export class MockAuthMiddleware implements NestMiddleware {
  constructor(private readonly em: EntityManager) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    // Get mock user from interceptor static storage
    const mockUser = MockAuthInterceptor.getMockUser();

    if (mockUser) {
      // Lookup actual database user by authId
      const dbUser = await this.em.findOne(User, { authId: mockUser.authId });

      if (dbUser) {
        // Inject auth data (simulating Clerk)
        req.auth = {
          authId: mockUser.authId,
          email: mockUser.email,
          fullName: mockUser.fullName,
        };

        // Inject database user
        req.user = {
          id: dbUser.id, // Use actual database ID!
          authId: dbUser.authId,
          email: dbUser.email,
          fullName: dbUser.fullName,
          role: dbUser.role,
          status: dbUser.status,
          createdAt: dbUser.createdAt,
          updatedAt: dbUser.updatedAt,
        };
      }
    }

    next();
  }
}
