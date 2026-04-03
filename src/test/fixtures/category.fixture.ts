// Dependencies
import { Collection } from '@mikro-orm/core';

// Modules
import { Category } from '@/modules/category/category.entity';
import { Post } from '@/modules/post/post.entity';

/**
 * Factory function to create test category instances
 */
export const createCategoryFixture = (
  overrides?: Partial<Category>
): Category => {
  const category = new Category();
  category.id = overrides?.id ?? 'category-123';
  category.name = overrides?.name ?? 'Test Category';
  category.posts = overrides?.posts ?? new Collection<Post>(category);
  category.createdAt = overrides?.createdAt ?? new Date('2024-01-01');

  return category;
};
