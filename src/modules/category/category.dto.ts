// Dependencies
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Extend Zod with OpenAPI
extendZodWithOpenApi(z);

export const categorySchema = z
  .object({
    id: z.uuid().openapi({
      description: 'Category unique identifier',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    name: z.string().openapi({
      description: 'Category name',
      example: 'Technology',
    }),
    createdAt: z.string().datetime().optional().openapi({
      description: 'Category creation timestamp',
      example: '2024-01-15T10:30:00.000Z',
    }),
  })
  .openapi('CategoryResponse', {
    description: 'Category object',
  });

export type CategoryResponse = z.infer<typeof categorySchema>;
