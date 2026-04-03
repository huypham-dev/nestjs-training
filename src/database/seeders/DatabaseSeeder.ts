// Dependencies
import { EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';

// Other
import { CategorySeeder } from './CategorySeeder';
import { PostSeeder } from './PostSeeder';

export class DatabaseSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    return this.call(em, [CategorySeeder, PostSeeder]);
  }
}
