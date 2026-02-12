// Dependencies
import { z } from 'zod';

// Constants
import { UserStatus } from '@/constants/users';

export const userQuerySchema = z.object({
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 0))
    .pipe(z.number().int().min(0, 'Offset must be a non-negative number')),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .pipe(z.number().int().min(1).max(100, 'Limit must be between 1 and 100')),
});

export const updateCurrentUserSchema = z.strictObject({
  fullName: z
    .string()
    .min(1, 'Full name must not be empty')
    .max(100, 'Full name must be less than 100 characters')
    .trim()
    .optional(),
  email: z.email('Invalid email address').trim().optional(),
});

export const updateUserStatusSchema = z.strictObject({
  status: z.enum(UserStatus),
});

export type UserQueryDto = z.infer<typeof userQuerySchema>;
export type updateCurrentUserDto = z.infer<typeof updateCurrentUserSchema>;
export type UpdateUserStatusDto = z.infer<typeof updateUserStatusSchema>;
