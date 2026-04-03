/* eslint-disable @typescript-eslint/require-await */
// Dependencies
import { Migration } from '@mikro-orm/migrations';

export class Migration20260325092359_AddIndexesToEntities extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "categories" add column "updated_at" timestamptz not null default now();`
    );
    this.addSql(
      `alter table "categories" alter column "updated_at" drop default;`
    );
    this.addSql(
      `alter table "categories" add constraint "categories_name_unique" unique ("name");`
    );

    this.addSql(
      `alter table "users" add constraint "users_email_unique" unique ("email");`
    );
    this.addSql(
      `create index "users_created_at_index" on "users" ("created_at");`
    );
    this.addSql(
      `create index "users_role_status_index" on "users" ("role", "status");`
    );
    this.addSql(`create index "users_email_index" on "users" ("email");`);

    this.addSql(`create index "posts_title_index" on "posts" ("title");`);
    this.addSql(
      `create index "posts_status_created_at_index" on "posts" ("status", "created_at");`
    );
    this.addSql(`create index "posts_user_id_index" on "posts" ("user_id");`);
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "categories" drop constraint "categories_name_unique";`
    );
    this.addSql(`alter table "categories" drop column "updated_at";`);

    this.addSql(`alter table "users" drop constraint "users_email_unique";`);
    this.addSql(`drop index "users_created_at_index";`);
    this.addSql(`drop index "users_role_status_index";`);
    this.addSql(`drop index "users_email_index";`);

    this.addSql(`drop index "posts_title_index";`);
    this.addSql(`drop index "posts_status_created_at_index";`);
    this.addSql(`drop index "posts_user_id_index";`);
  }
}
