/**
 * MikroORM CLI Configuration
 * Used by CLI commands: migration:create, migration:up, schema:update, etc.
 */
// Dependencies
import { Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';
import { SeedManager } from '@mikro-orm/seeder';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export default defineConfig({
  // Connection
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  dbName: process.env.DB_NAME || 'nestjs_blog_api',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',

  // Entities
  entities: ['./dist/**/*.entity.js'],
  entitiesTs: ['./src/**/*.entity.ts'],

  // Development
  debug: process.env.NODE_ENV !== 'production',

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
