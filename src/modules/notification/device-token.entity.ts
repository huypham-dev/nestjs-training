// Dependencies
import { Entity, Enum, Index, ManyToOne, Opt, Property } from '@mikro-orm/core';

// Common
import { BaseEntity } from '@/common/entities';

// Modules
import { User } from '@/modules/user/user.entity';
import { DevicePlatform } from '@/constants';

/**
 * Stores FCM device tokens for each user.
 * A single user may have tokens from multiple devices / platforms.
 */
@Entity({ tableName: 'device_tokens' })
@Index({ properties: ['user'] }) // fast lookup of all tokens for a user
export class DeviceToken extends BaseEntity {
  @ManyToOne(() => User, { fieldName: 'user_id', deleteRule: 'cascade' })
  user!: User;

  /** FCM registration token sent by the client SDK */
  @Property({ type: 'string', fieldName: 'token', unique: true })
  token!: string;

  @Enum({ items: () => DevicePlatform, fieldName: 'platform' })
  platform: DevicePlatform & Opt = DevicePlatform.WEB;

  /** Optional label to identify the device (e.g. "iPhone 15 Pro") */
  @Property({ type: 'string', fieldName: 'device_name', nullable: true })
  deviceName?: string;

  /** Last time FCM successfully delivered a message to this token */
  @Property({
    type: 'timestamptz',
    fieldName: 'last_used_at',
    nullable: true,
  })
  lastUsedAt?: Date;

  /** Soft-flag: FCM returned an invalid-token error – token should be cleaned up */
  @Property({ type: 'boolean', fieldName: 'is_active', default: true })
  isActive: boolean & Opt = true;
}
