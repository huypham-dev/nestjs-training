// Dependencies
import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  ManyToMany,
  Collection,
  Enum,
  Opt,
} from '@mikro-orm/core';
import { v4 } from 'uuid';

// Entities
import { User } from '@/modules/user/user.entity';
import { Category } from '@/modules/category/category.entity';

// Constants
import { PostStatus } from '@/constants';

@Entity({ tableName: 'posts' })
export class Post {
  @PrimaryKey({ type: 'uuid', fieldName: 'id' })
  id: string = v4();

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

  @Property({
    type: 'timestamp',
    fieldName: 'created_at',
    onCreate: () => new Date(),
  })
  createdAt: Date & Opt = new Date();

  @Property({
    type: 'timestamp',
    fieldName: 'updated_at',
    onUpdate: () => new Date(),
  })
  updatedAt: Date & Opt = new Date();
}
