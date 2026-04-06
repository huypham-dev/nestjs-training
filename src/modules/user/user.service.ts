// Dependencies
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable, Logger } from '@nestjs/common';

// Common
import { ResourceNotFoundException } from '@/common/exceptions';
import { SuccessResponse, QueryOptions } from '@/common/interfaces';

// Services
import { ClerkService } from '@/shared/services';

// Entities
import { User } from './user.entity';

// Constants
import { UserStatus } from '@/constants';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    private readonly em: EntityManager,
    private readonly clerkService: ClerkService
  ) {}

  async getAllUsers(
    options: QueryOptions = {}
  ): Promise<SuccessResponse<User[]>> {
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 10;

    const [users, total] = await this.userRepository.findAndCount(
      {},
      {
        offset,
        limit,
        orderBy: { createdAt: 'DESC' },
      }
    );

    return {
      data: users,
      ...(users.length > 0 && {
        meta: {
          pagination: {
            offset,
            limit,
            total,
          },
        },
      }),
    };
  }

  // Get user by their internal system ID
  async getUserById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ id });

    if (!user) {
      throw new ResourceNotFoundException('User not found in system');
    }

    return user;
  }

  // Update user by their internal system ID
  async updateUserById(
    id: string,
    payload: Partial<Pick<User, 'fullName' | 'email'>>
  ): Promise<User> {
    const user = await this.getUserById(id);

    Object.assign(user, payload);

    await this.em.flush();

    return user;
  }

  // Update user status by their internal system ID
  async updateUserStatus(id: string, status: UserStatus): Promise<User> {
    const user = await this.getUserById(id);

    const previousStatus = user.status;
    user.status = status;

    // Lock/Unlock user on Clerk based on status
    try {
      if (status === UserStatus.INACTIVE) {
        await this.clerkService.lockUser(user.authId);
      } else if (status === UserStatus.ACTIVE) {
        await this.clerkService.unlockUser(user.authId);
      }

      // Flush database change after Clerk operation to ensure consistency
      await this.em.flush();
    } catch (error) {
      // Rollback database change if Clerk operation fails
      user.status = previousStatus;
      await this.em.flush();
      throw error;
    }

    return user;
  }

  // Get user by their Clerk authentication ID
  async getUserByAuthId(authId: string): Promise<User | null> {
    return this.userRepository.findOne({ authId });
  }

  // Generic method to update user fields from webhook (without calling Clerk API)
  async updateUserFromWebhook(
    id: string,
    updates: Partial<Pick<User, 'status' | 'avatarUrl'>>
  ): Promise<User> {
    const user = await this.getUserById(id);

    Object.assign(user, updates);

    try {
      await this.em.flush();
      this.logger.log(
        `Successfully updated user ${user.id} from webhook: ${JSON.stringify(updates)}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to update user ${user.id} from webhook:`,
        error
      );
      // Re-throw error so webhook can be retried by Clerk
      throw new Error(
        `Failed to update user from webhook: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return user;
  }

  // Sync user with database and create if doesn't exist
  async syncUser(
    authId: string,
    email?: string,
    fullName?: string,
    avatarUrl?: string
  ): Promise<User> {
    let user = await this.userRepository.findOne({ authId });

    if (!user) {
      user = this.userRepository.create({
        authId,
        email: email ?? '',
        fullName: fullName ?? '',
        avatarUrl: avatarUrl ?? null,
      });

      await this.em.flush();
    }

    return user;
  }

  // Delete user by their internal system ID
  async deleteUser(id: string): Promise<void> {
    const user = await this.getUserById(id);

    // Delete user from Clerk first
    await this.clerkService.deleteUser(user.authId);

    // Delete user from database after successful Clerk deletion
    await this.em.remove(user).flush();
  }

  // Delete user by their Clerk authentication ID (from webhook)
  async deleteUserByAuthId(authId: string): Promise<void> {
    const user = await this.userRepository.findOne({ authId });

    if (!user) {
      this.logger.warn(
        `User deletion webhook received for non-existent authId: ${authId}`
      );
      return;
    }

    try {
      // Delete user from database (Clerk already deleted)
      await this.em.remove(user).flush();
      this.logger.log(`Successfully deleted user from database: ${user.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete user ${user.id} from database:`,
        error
      );
      // Re-throw error so webhook can be retried by Clerk
      throw new Error(
        `Failed to delete user from database: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
