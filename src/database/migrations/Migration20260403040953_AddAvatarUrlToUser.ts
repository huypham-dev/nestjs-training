/* eslint-disable @typescript-eslint/require-await */
// Dependencies
import { Migration } from '@mikro-orm/migrations';

export class Migration20260403040953_AddAvatarUrlToUser extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "users" add column "avatar_url" varchar(255) null;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "users" drop column "avatar_url";`);
  }
}
