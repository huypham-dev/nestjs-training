/* eslint-disable @typescript-eslint/require-await */
import { Migration } from '@mikro-orm/migrations';

export class Migration20260428034706_Create_Notification_Tables extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "device_tokens" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" uuid not null, "token" varchar(255) not null, "platform" text check ("platform" in ('android', 'ios', 'web')) not null default 'web', "device_name" varchar(255) null, "last_used_at" timestamptz null, "is_active" boolean not null default true, constraint "device_tokens_pkey" primary key ("id"));`
    );
    this.addSql(
      `alter table "device_tokens" add constraint "device_tokens_token_unique" unique ("token");`
    );
    this.addSql(
      `create index "device_tokens_user_id_index" on "device_tokens" ("user_id");`
    );
    this.addSql(
      `alter table "device_tokens" add constraint "device_tokens_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "device_tokens" cascade;`);
  }
}
