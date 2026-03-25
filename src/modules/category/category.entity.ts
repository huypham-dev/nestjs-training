// Dependencies
import { Entity, Property, ManyToMany, Collection } from '@mikro-orm/core';

// Base Entity
import { BaseEntity } from '@/common/entities';

// Entities
import { Post } from '@/modules/post/post.entity';

@Entity({ tableName: 'categories' })
export class Category extends BaseEntity {
  @Property({ type: 'string', fieldName: 'name' })
  name!: string;
  @ManyToMany({
    entity: () => Post,
    mappedBy: 'categories',
  })
  posts = new Collection<Post>(this);
}
