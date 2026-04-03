// Dependencies
import { Opt, PrimaryKey, Property } from '@mikro-orm/core';
import { v4 } from 'uuid';

/**
 * Base Entity class with common fields for all entities
 * - id: UUID primary key
 * - createdAt: Timestamp when entity was created
 * - updatedAt: Timestamp when entity was last updated
 */
export abstract class BaseEntity {
  @PrimaryKey({ type: 'uuid', fieldName: 'id' })
  id: string = v4();

  @Property({
    type: 'timestamp',
    fieldName: 'created_at',
    onCreate: () => new Date(),
  })
  createdAt: Date & Opt = new Date();

  @Property({
    type: 'timestamp',
    fieldName: 'updated_at',
    onCreate: () => new Date(),
    onUpdate: () => new Date(),
  })
  updatedAt: Date & Opt = new Date();
}
