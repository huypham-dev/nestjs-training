// Dependencies
import {
  Entity,
  Property,
  ManyToOne,
  ManyToMany,
  Collection,
  Enum,
  Opt,
  Index,
} from '@mikro-orm/core';

// Common
import { BaseEntity } from '@/common/entities';

// Modules
import { Category } from '@/modules/category/category.entity';
import { User } from '@/modules/user/user.entity';

// Constants
import { PostStatus } from '@/constants';

@Entity({ tableName: 'posts' })
@Index({ properties: ['user'] }) // Index for user_id lookups
@Index({ properties: ['status', 'createdAt'] }) // Compound index for filtering and sorting
export class Post extends BaseEntity {
  @Property({ type: 'string', fieldName: 'title' })
  title!: string;

  @Property({ type: 'text', fieldName: 'content' })
  content!: string;

  @Enum({ items: () => PostStatus, fieldName: 'status' })
  status: PostStatus & Opt = PostStatus.DRAFT;

  @Property({ type: 'timestamptz', fieldName: 'publish_at', nullable: true })
  publishAt?: Date | null;

  @Property({ type: 'timestamptz', fieldName: 'published_at', nullable: true })
  publishedAt?: Date | null;

  @Property({ type: 'timestamptz', fieldName: 'cancelled_at', nullable: true })
  cancelledAt?: Date | null;

  @Property({ type: 'string', fieldName: 'image_url', nullable: true })
  imageUrl?: string | null;

  @Property({
    type: 'string',
    fieldName: 'image_thumbnail_url',
    nullable: true,
  })
  imageThumbnailUrl?: string | null;

  @ManyToOne(() => User, {
    fieldName: 'user_id',
    nullable: false,
  })
  user!: User;

  @ManyToMany({
    entity: () => Category,
    inversedBy: 'posts',
    pivotEntity: 'PostCategory',
  })
  categories = new Collection<Category>(this);
}
