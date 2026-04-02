/* eslint-disable @typescript-eslint/require-await */
import { Migration } from '@mikro-orm/migrations';

export class Migration20260402030744_AddImageFieldsToPosts extends Migration {
  override async up(): Promise<void> {
    this.addSql(`drop index "users_email_index";`);

    this.addSql(`drop index "posts_title_index";`);

    this.addSql(
      `alter table "posts" add column "image_url" varchar(255) null, add column "image_thumbnail_url" varchar(255) null;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`create index "users_email_index" on "users" ("email");`);

    this.addSql(
      `alter table "posts" drop column "image_url", drop column "image_thumbnail_url";`
    );

    this.addSql(`create index "posts_title_index" on "posts" ("title");`);
  }
}
