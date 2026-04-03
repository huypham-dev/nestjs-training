// Modules
import { User } from '@/modules/user/user.entity';

// Constants
import { UserRole, UserStatus } from '@/constants';

/**
 * Factory function to create test user instances
 */
export const createUserFixture = (overrides?: Partial<User>): User => {
  const user = new User();
  user.id = overrides?.id ?? 'user-123';
  user.authId = overrides?.authId ?? 'auth-123';
  user.email = overrides?.email ?? 'test@example.com';
  user.fullName = overrides?.fullName ?? 'Test User';
  user.avatarUrl = overrides?.avatarUrl ?? undefined;
  user.role = overrides?.role ?? UserRole.USER;
  user.status = overrides?.status ?? UserStatus.ACTIVE;
  user.createdAt = overrides?.createdAt ?? new Date('2024-01-01');
  user.updatedAt = overrides?.updatedAt ?? new Date('2024-01-01');

  return user;
};

/**
 * Create admin user fixture
 */
export const createAdminUserFixture = (overrides?: Partial<User>): User => {
  return createUserFixture({
    id: 'admin-123',
    authId: 'auth-admin-123',
    email: 'admin@example.com',
    fullName: 'Admin User',
    role: UserRole.ADMIN,
    ...overrides,
  });
};

/**
 * Create inactive user fixture
 */
export const createInactiveUserFixture = (overrides?: Partial<User>): User => {
  return createUserFixture({
    status: UserStatus.INACTIVE,
    ...overrides,
  });
};
