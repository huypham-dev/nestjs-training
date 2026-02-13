// Dependencies
import { z } from 'zod';

// Constants
import { PostStatus } from '@/constants';
import { categorySchema } from '../category/category.dto';

/**
 * Schema for query parameters when getting posts
 */
export const postQuerySchema = z.object({
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
  status: z.enum(PostStatus, { error: 'Invalid status' }).optional(),
});

export const createPostSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters')
    .trim(),
  content: z.string().min(1, 'Content is required').trim(),
  categoryIds: z.array(z.uuid('Invalid category ID')),
});

export const updatePostSchema = z.strictObject({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters')
    .trim()
    .optional(),
  content: z.string().min(1, 'Content is required').trim().optional(),
  categoryIds: z.array(z.uuid('Invalid category ID')).optional(),
  status: z.enum(PostStatus, { error: 'Invalid status' }).optional(),
});

export const postSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  content: z.string(),
  status: z.enum(PostStatus),
  categories: z.array(categorySchema),
  author: z.object({
    id: z.uuid(),
    email: z.email(),
    fullName: z.string(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PostQueryDto = z.infer<typeof postQuerySchema>;
export type CreatePostDto = z.infer<typeof createPostSchema>;
export type UpdatePostDto = z.infer<typeof updatePostSchema>;
export type PostResponse = z.infer<typeof postSchema>;
