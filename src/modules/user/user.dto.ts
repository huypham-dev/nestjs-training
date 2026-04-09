// Dependencies
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Constants
import { UserRole, UserStatus } from '@/constants';

// Extend Zod with OpenAPI
extendZodWithOpenApi(z);

export const userQuerySchema = z
  .object({
    offset: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 0))
      .pipe(z.number().int().min(0, 'Offset must be a non-negative number')),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(
        z.number().int().min(1).max(100, 'Limit must be between 1 and 100')
      ),
  })
  .openapi({
    description: 'Query parameters for listing users',
    example: { offset: '0', limit: '10' },
  });

export const updateCurrentUserSchema = z
  .strictObject({
    fullName: z
      .string()
      .min(1, 'Full name must not be empty')
      .max(100, 'Full name must be less than 100 characters')
      .trim()
      .optional()
      .openapi({
        description: 'Updated full name',
        example: 'Jane Doe',
      }),
    email: z.email('Invalid email address').trim().optional().openapi({
      description: 'Updated email address',
      example: 'jane.doe@example.com',
    }),
    avatarUrl: z.url('Invalid URL format').trim().optional().openapi({
      description: 'Updated avatar URL',
      example: 'https://example.com/avatar.jpg',
    }),
  })
  .openapi('UpdateCurrentUserRequest', {
    description: 'Schema for updating current user profile',
  });

export const updateUserStatusSchema = z
  .strictObject({
    status: z.enum(UserStatus).openapi({
      description: 'New user status',
      example: UserStatus.INACTIVE,
    }),
  })
  .openapi('UpdateUserStatusRequest', {
    description: 'Schema for updating user account status',
  });

export const createUserSchema = z
  .strictObject({
    authId: z.string().min(1, 'Auth ID is required').openapi({
      description: 'Clerk authentication ID',
      example: 'user_2abc123def456',
    }),
    email: z.string().email('Invalid email address').trim().openapi({
      description: 'User email address',
      example: 'john.doe@example.com',
    }),
    fullName: z
      .string()
      .min(1, 'Full name is required')
      .max(100, 'Full name must be less than 100 characters')
      .trim()
      .openapi({
        description: 'User full name',
        example: 'John Doe',
      }),
    avatarUrl: z.string().url('Invalid URL format').trim().optional().openapi({
      description: 'User avatar URL',
      example: 'https://img.clerk.com/avatar.jpg',
    }),
  })
  .openapi('CreateUserData', {
    description: 'Schema for creating a new user',
  });

export const userSchema = z
  .object({
    id: z.uuid().openapi({
      description: 'User unique identifier',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    authId: z.string().openapi({
      description: 'Clerk authentication ID',
      example: 'user_2abc123def456',
    }),
    email: z.email().openapi({
      description: 'User email address',
      example: 'john.doe@example.com',
    }),
    fullName: z.string().openapi({
      description: 'User full name',
      example: 'John Doe',
    }),
    avatarUrl: z.string().url().nullable().openapi({
      description: 'User avatar URL',
      example: 'https://img.clerk.com/avatar.jpg',
    }),
    role: z.enum(UserRole).openapi({
      description: 'User role',
      example: UserRole.USER,
    }),
    status: z.enum(UserStatus).openapi({
      description: 'User account status',
      example: UserStatus.ACTIVE,
    }),
    createdAt: z.string().datetime().openapi({
      description: 'Account creation timestamp',
      example: '2024-01-15T10:30:00.000Z',
    }),
    updatedAt: z.string().datetime().openapi({
      description: 'Last update timestamp',
      example: '2024-01-15T10:30:00.000Z',
    }),
  })
  .openapi('UserResponse', {
    description: 'User object with all fields',
  });

export type UserQueryDto = z.infer<typeof userQuerySchema>;
export type updateCurrentUserDto = z.infer<typeof updateCurrentUserSchema>;
export type UpdateUserStatusDto = z.infer<typeof updateUserStatusSchema>;
export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UserResponse = z.infer<typeof userSchema>;
