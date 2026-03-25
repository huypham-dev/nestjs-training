// Dependencies
import {
  Entity,
  Property,
  ManyToOne,
  ManyToMany,
  Collection,
  Enum,
  Opt,
} from '@mikro-orm/core';

// Base Entity
import { BaseEntity } from '@/common/entities';

// Entities
import { User } from '@/modules/user/user.entity';
import { Category } from '@/modules/category/category.entity';

// Constants
import { PostStatus } from '@/constants';

@Entity({ tableName: 'posts' })
export class Post extends BaseEntity {
  @Property({ type: 'string', fieldName: 'title' })
  title!: string;

  @Property({ type: 'text', fieldName: 'content' })
  content!: string;

  @Enum({ items: () => PostStatus, fieldName: 'status' })
  status: PostStatus & Opt = PostStatus.DRAFT;

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
