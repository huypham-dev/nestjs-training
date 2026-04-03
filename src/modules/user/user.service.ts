// Dependencies
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

// Entities
import { User } from './user.entity';

// Services
import { ClerkService } from '@/shared/services';

// Exceptions
import { ResourceNotFoundException } from '@/common/exceptions';

// Constants
import { UserStatus } from '@/constants/users';
import { SuccessResponse, QueryOptions } from '@/common/interfaces';

@Injectable()
export class UserService {
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

    await this.em.flush();

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
}
