import { EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';
import { Category } from '@/modules/category/category.entity';

export class CategorySeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    const categories = [
      { name: 'Technology' },
      { name: 'Programming' },
      { name: 'Web Development' },
      { name: 'Mobile Development' },
      { name: 'Database' },
      { name: 'DevOps' },
      { name: 'Security' },
      { name: 'AI & Machine Learning' },
      { name: 'Cloud Computing' },
      { name: 'Tutorial' },
      { name: 'Best Practices' },
      { name: 'News' },
    ];

    for (const categoryData of categories) {
      // Check if category already exists
      const exists = await em.findOne(Category, { name: categoryData.name });
      if (!exists) {
        em.create(Category, categoryData);
      }
    }

    await em.flush();
  }
}
