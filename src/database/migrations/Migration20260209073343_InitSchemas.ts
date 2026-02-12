/* eslint-disable @typescript-eslint/require-await */
import { Migration } from '@mikro-orm/migrations';

export class Migration20260209073343_InitSchemas extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "categories" ("id" uuid not null, "name" varchar(255) not null, "created_at" timestamptz not null, constraint "categories_pkey" primary key ("id"));`
    );

    this.addSql(
      `create table "users" ("id" uuid not null, "auth_id" varchar(255) not null, "email" varchar(255) not null, "full_name" varchar(255) not null, "role" text check ("role" in ('user', 'admin')) not null default 'user', "status" text check ("status" in ('active', 'inactive')) not null default 'active', "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "users_pkey" primary key ("id"));`
    );
    this.addSql(
      `alter table "users" add constraint "users_auth_id_unique" unique ("auth_id");`
    );

    this.addSql(
      `create table "posts" ("id" uuid not null, "title" varchar(255) not null, "content" text not null, "status" text check ("status" in ('draft', 'published')) not null default 'draft', "user_id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "posts_pkey" primary key ("id"));`
    );

    this.addSql(
      `create table "post_categories" ("post_id" uuid not null, "category_id" uuid not null, constraint "post_categories_pkey" primary key ("post_id", "category_id"));`
    );

    this.addSql(
      `alter table "posts" add constraint "posts_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`
    );

    this.addSql(
      `alter table "post_categories" add constraint "post_categories_post_id_foreign" foreign key ("post_id") references "posts" ("id") on update cascade;`
    );
    this.addSql(
      `alter table "post_categories" add constraint "post_categories_category_id_foreign" foreign key ("category_id") references "categories" ("id") on update cascade;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "post_categories" drop constraint "post_categories_category_id_foreign";`
    );

    this.addSql(`alter table "posts" drop constraint "posts_user_id_foreign";`);

    this.addSql(
      `alter table "post_categories" drop constraint "post_categories_post_id_foreign";`
    );

    this.addSql(`drop table if exists "categories" cascade;`);

    this.addSql(`drop table if exists "users" cascade;`);

    this.addSql(`drop table if exists "posts" cascade;`);

    this.addSql(`drop table if exists "post_categories" cascade;`);
  }
}
