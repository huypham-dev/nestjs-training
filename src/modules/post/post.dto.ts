// Dependencies
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// DTOs
import { categorySchema } from '../category/category.dto';

// Constants
import { PostStatus } from '@/constants';

// Extend Zod with OpenAPI
extendZodWithOpenApi(z);

/**
 * Schema for query parameters when getting posts
 */
export const postQuerySchema = z
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
    status: z.enum(PostStatus, { error: 'Invalid status' }).optional().openapi({
      description: 'Filter posts by status',
      example: PostStatus.PUBLISHED,
    }),
    q: z
      .string()
      .trim()
      .min(1, 'Search query must not be empty')
      .optional()
      .openapi({
        description: 'Search posts by title (case-insensitive partial match)',
        example: 'nestjs',
      }),
  })
  .openapi({
    description: 'Query parameters for listing posts',
    example: {
      offset: '0',
      limit: '10',
      status: 'published',
      search: 'nestjs',
    },
  });

export const createPostSchema = z
  .object({
    title: z
      .string()
      .min(1, 'Title is required')
      .max(200, 'Title must be less than 200 characters')
      .trim()
      .openapi({
        description: 'Post title',
        example: 'Getting Started with NestJS',
      }),
    content: z.string().min(1, 'Content is required').trim().openapi({
      description: 'Post content',
      example:
        'NestJS is a progressive Node.js framework for building efficient and scalable server-side applications.',
    }),
    categoryIds: z
      .preprocess(
        (value) => {
          if (!value) return [];
          return Array.isArray(value) ? value : [value];
        },
        z.array(z.uuid('Invalid category ID'))
      )
      .openapi({
        description: 'Array of category UUIDs to associate with the post',
        example: ['550e8400-e29b-41d4-a716-446655440000'],
      }),
  })
  .openapi('CreatePostRequest', {
    description: 'Schema for creating a new blog post',
  });

export const updatePostSchema = z
  .strictObject({
    title: z
      .string()
      .min(1, 'Title is required')
      .max(200, 'Title must be less than 200 characters')
      .trim()
      .optional()
      .openapi({
        description: 'Updated post title',
        example: 'Advanced NestJS Techniques',
      }),
    content: z
      .string()
      .min(1, 'Content is required')
      .trim()
      .optional()
      .openapi({
        description: 'Updated post content',
        example: 'In this post, we explore advanced NestJS patterns...',
      }),
    categoryIds: z
      .preprocess(
        (value) => {
          if (!value) return [];
          return Array.isArray(value) ? value : [value];
        },
        z.array(z.uuid('Invalid category ID'))
      )
      .openapi({
        description: 'Updated array of category UUIDs',
        example: ['550e8400-e29b-41d4-a716-446655440000'],
      }),
    status: z.enum(PostStatus, { error: 'Invalid status' }).optional().openapi({
      description: 'Updated post status',
      example: PostStatus.PUBLISHED,
    }),
  })
  .openapi('UpdatePostRequest', {
    description: 'Schema for updating an existing post',
  });

export const postSchema = z
  .object({
    id: z.uuid().openapi({
      description: 'Post unique identifier',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    title: z.string().openapi({
      description: 'Post title',
      example: 'Getting Started with NestJS',
    }),
    content: z.string().openapi({
      description: 'Post content',
      example: 'NestJS is a progressive Node.js framework...',
    }),
    status: z.enum(PostStatus).openapi({
      description: 'Post publication status',
      example: PostStatus.PUBLISHED,
    }),
    publishAt: z.string().nullable().optional().openapi({
      description: 'Scheduled publish timestamp',
      example: '2024-12-31T23:59:59.000Z',
    }),
    publishedAt: z.string().nullable().optional().openapi({
      description: 'Actual published timestamp',
      example: '2024-01-15T10:30:00.000Z',
    }),
    imageUrl: z.url().nullable().optional().openapi({
      description: 'URL of the original post image',
      example:
        'https://bucket.s3.region.amazonaws.com/posts/images/original/uuid.jpg',
    }),
    imageThumbnailUrl: z.url().nullable().optional().openapi({
      description: 'URL of the post thumbnail image',
      example:
        'https://bucket.s3.region.amazonaws.com/posts/images/thumbnails/uuid.jpg',
    }),
    categories: z.array(categorySchema).openapi({
      description: 'Categories associated with the post',
    }),
    author: z
      .object({
        id: z.uuid().openapi({
          description: 'Author unique identifier',
          example: '550e8400-e29b-41d4-a716-446655440000',
        }),
        email: z.email().openapi({
          description: 'Author email address',
          example: 'john.doe@example.com',
        }),
        fullName: z.string().openapi({
          description: 'Author full name',
          example: 'John Doe',
        }),
      })
      .openapi({
        description: 'Post author information',
      }),
    createdAt: z.string().openapi({
      description: 'Post creation timestamp',
      example: '2024-01-15T10:30:00.000Z',
    }),
    updatedAt: z.string().openapi({
      description: 'Post last update timestamp',
      example: '2024-01-15T10:30:00.000Z',
    }),
  })
  .openapi('PostResponse', {
    description: 'Blog post object with all fields',
  });

export type PostQueryDto = z.infer<typeof postQuerySchema>;
export type CreatePostDto = z.infer<typeof createPostSchema>;
export type UpdatePostDto = z.infer<typeof updatePostSchema>;
export type PostResponse = z.infer<typeof postSchema>;

/**
 * Schema for scheduling a post
 */
export const schedulePostSchema = z
  .strictObject({
    publishAt: z.coerce
      .date()
      .refine((date) => date > new Date(), {
        message: 'Publish date must be in the future',
      })
      .openapi({
        description: 'Date and time when the post should be published',
        example: '2024-12-31T23:59:59.000Z',
      }),
  })
  .openapi('SchedulePostRequest', {
    description: 'Schema for scheduling a post for future publishing',
  });

export type SchedulePostDto = z.infer<typeof schedulePostSchema>;
