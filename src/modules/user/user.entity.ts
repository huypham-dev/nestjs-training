// Dependencies
import {
  Entity,
  Enum,
  Opt,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/core';
import { v4 } from 'uuid';

// Constants
import { UserRole, UserStatus } from '@/constants/users';

@Entity({ tableName: 'users' })
export class User {
  @PrimaryKey({ type: 'uuid', fieldName: 'id' })
  id: string = v4();

  @Property({ type: 'string', fieldName: 'auth_id' })
  @Unique()
  authId!: string;

  @Property({ type: 'string', fieldName: 'email' })
  email!: string;

  @Property({ type: 'string', fieldName: 'full_name' })
  fullName!: string;

  @Enum({ items: () => UserRole, fieldName: 'role' })
  role: UserRole & Opt = UserRole.USER;

  @Enum({ items: () => UserStatus, fieldName: 'status' })
  status: UserStatus & Opt = UserStatus.ACTIVE;

  @Property({
    type: 'timestamp',
    fieldName: 'created_at',
    onCreate: () => new Date(),
  })
  createdAt: Date & Opt = new Date();

  @Property({
    type: 'timestamp',
    fieldName: 'updated_at',
    onUpdate: () => new Date(),
  })
  updatedAt: Date & Opt = new Date();
}
