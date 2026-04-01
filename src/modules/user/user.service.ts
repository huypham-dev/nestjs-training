// Dependencies
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

// Entities
import { User } from './user.entity';

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
    private readonly em: EntityManager
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

    user.status = status;

    await this.em.flush();

    return user;
  }

  // Sync user with database and create if doesn't exist
  async syncUser(
    authId: string,
    email?: string,
    fullName?: string
  ): Promise<User> {
    let user = await this.userRepository.findOne({ authId });

    if (!user) {
      user = this.userRepository.create({
        authId,
        email: email ?? '',
        fullName: fullName ?? '',
      });

      await this.em.flush();
    }

    return user;
  }
}
