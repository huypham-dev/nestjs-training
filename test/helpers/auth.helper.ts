/**
 * Authentication Helper for E2E Tests
 * Mocks Clerk authentication middleware
 */

import { Request, Response, NextFunction } from 'express';
import { UserRole, UserStatus } from '@/constants/users';

export interface MockAuthUser {
  authId: string;
  email: string;
  fullName: string;
  role?: UserRole;
  status?: UserStatus;
}

/**
 * Create mock authentication middleware that bypasses Clerk
 */
export const createMockAuthMiddleware = (mockUser: MockAuthUser) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    // Mock Clerk auth
    req.auth = {
      authId: mockUser.authId,
      email: mockUser.email,
      fullName: mockUser.fullName,
    };

    // Mock user from database
    req.user = {
      id: mockUser.authId,
      authId: mockUser.authId,
      email: mockUser.email,
      fullName: mockUser.fullName,
      role: mockUser.role || UserRole.USER,
      status: mockUser.status || UserStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    next();
  };
};

/**
 * Predefined test users
 */
export const TEST_USERS = {
  ADMIN: {
    authId: 'admin-test-id',
    email: 'admin@test.com',
    fullName: 'Admin User',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  },
  USER1: {
    authId: 'user1-test-id',
    email: 'user1@test.com',
    fullName: 'Test User 1',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
  },
  USER2: {
    authId: 'user2-test-id',
    email: 'user2@test.com',
    fullName: 'Test User 2',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
  },
  INACTIVE_USER: {
    authId: 'inactive-test-id',
    email: 'inactive@test.com',
    fullName: 'Inactive User',
    role: UserRole.USER,
    status: UserStatus.INACTIVE,
  },
} as const;
