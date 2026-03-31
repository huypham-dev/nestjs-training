// Dependencies
import { Entity, Enum, Opt, Property, Unique, Index } from '@mikro-orm/core';

// Base Entity
import { BaseEntity } from '@/common/entities';

// Constants
import { UserRole, UserStatus } from '@/constants/users';

@Entity({ tableName: 'users' })
@Index({ properties: ['role', 'status'] }) // Compound index for filtering
@Index({ properties: ['createdAt'] }) // Index for sorting by date
export class User extends BaseEntity {
  @Property({ type: 'string', fieldName: 'auth_id' })
  @Unique()
  authId!: string;

  @Property({ type: 'string', fieldName: 'email' })
  @Unique() // Email should be unique
  email!: string;

  @Property({ type: 'string', fieldName: 'full_name' })
  fullName!: string;

  @Enum({ items: () => UserRole, fieldName: 'role' })
  role: UserRole & Opt = UserRole.USER;

  @Enum({ items: () => UserStatus, fieldName: 'status' })
  status: UserStatus & Opt = UserStatus.ACTIVE;
}
