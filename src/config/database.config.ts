import { defineConfig } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';
import { SeedManager } from '@mikro-orm/seeder';
import { ConfigService } from '@nestjs/config';

export const createDatabaseConfig = (configService: ConfigService) =>
  defineConfig({
    // Connection
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', 5432),
    dbName: configService.get<string>('DB_NAME', 'nestjs_blog_api'),
    user: configService.get<string>('DB_USER', 'postgres'),
    password: configService.get<string>('DB_PASSWORD', ''),

    // Entities
    entities: ['./dist/**/*.entity.js'],
    entitiesTs: ['./src/**/*.entity.ts'],

    // Development
    debug: configService.get<string>('NODE_ENV') !== 'production',
    allowGlobalContext: false,

    // Migrations
    migrations: {
      path: './dist/database/migrations',
      pathTs: './src/database/migrations',
      tableName: 'mikro_orm_migrations',
      transactional: true,
      disableForeignKeys: false,
      allOrNothing: true,
      emit: 'ts',
      snapshot: true,
    },

    // Seeding
    seeder: {
      path: './dist/database/seeders',
      pathTs: './src/database/seeders',
      defaultSeeder: 'DatabaseSeeder',
      glob: '!(*.d).{js,ts}',
      emit: 'ts',
    },

    // Extensions
    extensions: [Migrator, SeedManager],

    // Schema settings
    schemaGenerator: {
      disableForeignKeys: false,
      createForeignKeyConstraints: true,
    },
  });
