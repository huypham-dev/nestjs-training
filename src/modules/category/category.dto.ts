import { z } from 'zod';

export const categorySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  createdAt: z.iso.datetime().optional(),
});

export type CategoryResponse = z.infer<typeof categorySchema>;
