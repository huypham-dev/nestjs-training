/* eslint-disable @typescript-eslint/require-await */
import { Migration } from '@mikro-orm/migrations';

export class Migration20260413100358_AddPostTimestamps extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "posts" drop constraint if exists "posts_status_check";`
    );

    this.addSql(
      `alter table "posts" add column "publish_at" timestamptz null, add column "published_at" timestamptz null, add column "cancelled_at" timestamptz null;`
    );
    this.addSql(
      `alter table "posts" add constraint "posts_status_check" check("status" in ('draft', 'scheduled', 'published', 'cancelled'));`
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "posts" drop constraint if exists "posts_status_check";`
    );

    this.addSql(
      `alter table "posts" drop column "publish_at", drop column "published_at", drop column "cancelled_at";`
    );

    this.addSql(
      `alter table "posts" add constraint "posts_status_check" check("status" in ('draft', 'published'));`
    );
  }
}
