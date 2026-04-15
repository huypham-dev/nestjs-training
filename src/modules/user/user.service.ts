// Dependencies
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Inject, Injectable, Logger } from '@nestjs/common';

// Common
import { ResourceNotFoundException } from '@/common/exceptions';
import { SuccessResponse, QueryOptions } from '@/common/interfaces';

// Services
import type { IAuthService } from '@/shared/services';
import { AUTH_SERVICE } from '@/shared/services';

// Entities
import { User } from './user.entity';

// DTOs
import type { CreateUserDto } from './user.dto';

// Constants
import { UserStatus } from '@/constants';

// Gateway
import { UserStatusGateway } from './user-status.gateway';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    private readonly em: EntityManager,
    @Inject(AUTH_SERVICE)
    private readonly authService: IAuthService,
    private readonly userStatusGateway: UserStatusGateway
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

    // Lock/Unlock user on auth provider based on status
    try {
      if (status === UserStatus.INACTIVE) {
        await this.authService.lockUser(user.authId);
      } else if (status === UserStatus.ACTIVE) {
        await this.authService.unlockUser(user.authId);
      }

      // Flush database change after auth provider operation to ensure consistency
      await this.em.flush();

      // Emit realtime event to connected WebSocket clients
      this.userStatusGateway.emitUserStatusChanged(user);
    } catch (error) {
      // Rollback database change if auth provider operation fails
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

  /**
   * Update user fields
   *
   * Generic method to update user fields. Can be used by webhooks, admin updates,
   * or any other update flow. Does not call external APIs (like Clerk).
   *
   * @param id - User's internal system ID
   * @param updates - Partial user data to update (status, avatarUrl, etc.)
   * @returns Updated user entity
   * @throws Error if update fails
   */
  async updateUser(
    id: string,
    updates: Partial<Pick<User, 'status' | 'avatarUrl'>>
  ): Promise<User> {
    const user = await this.getUserById(id);

    Object.assign(user, updates);

    try {
      await this.em.flush();
      this.logger.log(
        `Successfully updated user ${user.id}: ${JSON.stringify(updates)}`
      );
    } catch (error) {
      this.logger.error(`Failed to update user ${user.id}:`, error);
      throw new Error(
        `Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return user;
  }

  /**
   * Create a new user
   *
   * Creates a new user in the database with the provided authentication and profile information.
   * Can be used by webhooks, admin creation, or any other user creation flow.
   *
   * @param data - User creation data (validated with createUserSchema)
   * @returns Newly created user entity or existing user if already exists
   * @throws Error if user creation fails
   */
  async createUser(data: CreateUserDto): Promise<User> {
    try {
      // Check if user already exists to prevent duplicates
      const existingUser = await this.userRepository.findOne({
        authId: data.authId,
      });

      if (existingUser) {
        this.logger.warn(
          `User with authId ${data.authId} already exists, skipping creation`
        );
        return existingUser;
      }

      // Create new user
      const user = this.userRepository.create({
        authId: data.authId,
        email: data.email,
        fullName: data.fullName,
        avatarUrl: data.avatarUrl ?? null,
      });

      await this.em.flush();

      this.logger.log(
        `Successfully created user: ${user.id} (authId: ${data.authId})`
      );

      return user;
    } catch (error) {
      this.logger.error(
        `Failed to create user (authId: ${data.authId}):`,
        error
      );
      throw new Error(
        `Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
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
}
