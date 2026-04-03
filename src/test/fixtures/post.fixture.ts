// Dependencies
import { Collection } from '@mikro-orm/core';

// Modules
import { Category } from '@/modules/category/category.entity';
import { Post } from '@/modules/post/post.entity';

// Constants
import { PostStatus } from '@/constants';

// Other
import { createUserFixture } from './user.fixture';

/**
 * Factory function to create test post instances
 */
export const createPostFixture = (overrides?: Partial<Post>): Post => {
  const post = new Post();
  post.id = overrides?.id ?? 'post-123';
  post.title = overrides?.title ?? 'Test Post';
  post.content = overrides?.content ?? 'Test content';
  post.status = overrides?.status ?? PostStatus.DRAFT;
  post.user = overrides?.user ?? createUserFixture();
  post.categories = overrides?.categories ?? new Collection<Category>(post);
  post.createdAt = overrides?.createdAt ?? new Date('2024-01-01');
  post.updatedAt = overrides?.updatedAt ?? new Date('2024-01-01');

  return post;
};

/**
 * Create published post fixture
 */
export const createPublishedPostFixture = (overrides?: Partial<Post>): Post => {
  return createPostFixture({
    status: PostStatus.PUBLISHED,
    ...overrides,
  });
};
