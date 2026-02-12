// Dependencies
import {
  Entity,
  PrimaryKey,
  Property,
  ManyToMany,
  Collection,
  Opt,
} from '@mikro-orm/core';
import { v4 } from 'uuid';

// Entities
import { Post } from '@/modules/post/post.entity';

@Entity({ tableName: 'categories' })
export class Category {
  @PrimaryKey({ type: 'uuid', fieldName: 'id' })
  id: string = v4();

  @Property({ type: 'string', fieldName: 'name' })
  name!: string;
  @ManyToMany({
    entity: () => Post,
    mappedBy: 'categories',
  })
  posts = new Collection<Post>(this);

  @Property({
    type: 'timestamp',
    fieldName: 'created_at',
    onCreate: () => new Date(),
  })
  createdAt: Date & Opt = new Date();
}
