import { Entity, ManyToOne, PrimaryKeyProp } from '@mikro-orm/core';
import { Post } from '@/modules/post/post.entity';
import { Category } from '@/modules/category/category.entity';

@Entity({ tableName: 'post_categories' })
export class PostCategory {
  [PrimaryKeyProp]?: ['post', 'category'];

  @ManyToOne(() => Post, { primary: true, fieldName: 'post_id' })
  post!: Post;

  @ManyToOne(() => Category, { primary: true, fieldName: 'category_id' })
  category!: Category;
}
