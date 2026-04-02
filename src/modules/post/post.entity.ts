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

// Base Entity
import { BaseEntity } from '@/common/entities';

// Entities
import { User } from '@/modules/user/user.entity';
import { Category } from '@/modules/category/category.entity';

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
