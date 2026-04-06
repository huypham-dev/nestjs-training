// Dependencies
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiSecurity } from '@nestjs/swagger';

// Common
import { ApiDocumentation } from '@/common/decorators';
import { ZodValidationPipe } from '@/common/pipes';
import { CacheService } from '@/common/services';

// Services
import { UserService } from './user.service';

// Guards
import { PreventSameUserActionGuard } from './user.guards';

// Entities
import { User } from './user.entity';

// DTOs
import {
  updateCurrentUserSchema,
  updateUserStatusSchema,
  userQuerySchema,
} from './user.dto';
import type {
  updateCurrentUserDto,
  UpdateUserStatusDto,
  UserQueryDto,
} from './user.dto';

// Decorators
import { CurrentUser, Roles } from './user.decorators';

// Constants
import { UserRole } from '@/constants';
// import { CACHE_KEYS } from '@/constants';

@ApiTags('Users')
@ApiSecurity('Auth')
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly cacheService: CacheService
  ) {}

  // Get all users (admin only)
  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  // @UseInterceptors(CacheInterceptor)
  // @CacheKey(CACHE_KEYS.USERS_LIST)
  // @CacheTTL(60000) // 60 seconds
  @ApiDocumentation({
    operation: {
      summary: 'Get all users (Admin only)',
      description:
        'Retrieve a paginated list of all users in the system. Only accessible by administrators.',
    },
    response: {
      status: 200,
      description: 'Successfully retrieved users list',
      schema: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/UserResponse' },
          },
          meta: {
            type: 'object',
            properties: {
              pagination: {
                type: 'object',
                properties: {
                  offset: { type: 'number' },
                  limit: { type: 'number' },
                  total: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
  })
  async getAllUsers(
    @Query(new ZodValidationPipe(userQuerySchema)) query: UserQueryDto
  ) {
    const result = await this.userService.getAllUsers({
      offset: query.offset ?? 0,
      limit: query.limit ?? 10,
    });

    return {
      data: result.data,
      ...(result.meta ? { meta: result.meta } : {}),
    };
  }

  // Get current authenticated user
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000) // 30 seconds
  @ApiDocumentation({
    operation: {
      summary: 'Get current user profile',
      description:
        'Retrieve the profile information of the currently authenticated user.',
    },
    response: {
      status: 200,
      description: 'Successfully retrieved current user profile',
      schema: {
        type: 'object',
        properties: {
          data: { $ref: '#/components/schemas/UserResponse' },
        },
      },
    },
  })
  getCurrentUser(@CurrentUser() user: User) {
    return {
      data: user,
    };
  }

  // Update current user information
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiDocumentation({
    operation: {
      summary: 'Update current user profile',
      description:
        'Update the profile information (fullName, email) of the currently authenticated user.',
    },
    body: {
      schema: { $ref: '#/components/schemas/UpdateCurrentUserRequest' },
      description: 'User profile update data',
    },
    response: {
      status: 200,
      description: 'Successfully updated user profile',
      schema: {
        type: 'object',
        properties: {
          data: { $ref: '#/components/schemas/UserResponse' },
        },
      },
    },
  })
  async updateCurrentUser(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(updateCurrentUserSchema))
    payload: updateCurrentUserDto
  ) {
    const updatedUser = await this.userService.updateUserById(user.id, payload);

    // Invalidate user caches
    await this.cacheService.invalidateUserCaches(user.id);

    return {
      data: updatedUser,
    };
  }

  // Get user by ID
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60000) // 60 seconds
  @ApiDocumentation({
    operation: {
      summary: 'Get user by ID',
      description:
        'Retrieve a user profile by their UUID. Accessible to all authenticated users.',
    },
    params: [
      {
        name: 'id',
        type: 'string',
        format: 'uuid',
        description: 'User UUID',
        example: '550e8400-e29b-41d4-a716-446655440000',
      },
    ],
    response: {
      status: 200,
      description: 'Successfully retrieved user profile',
      schema: {
        type: 'object',
        properties: {
          data: { $ref: '#/components/schemas/UserResponse' },
        },
      },
    },
  })
  async getUserById(@Param('id', ParseUUIDPipe) userId: string) {
    const user = await this.userService.getUserById(userId);

    return {
      data: user,
    };
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PreventSameUserActionGuard)
  @Roles(UserRole.ADMIN)
  @ApiDocumentation({
    operation: {
      summary: 'Update user status (Admin only)',
      description:
        'Update the status of a user account (ACTIVE/INACTIVE). Setting status to INACTIVE will lock the user on Clerk (prevents login). Setting status to ACTIVE will unlock the user on Clerk (allows login). Only accessible by administrators. Cannot update own status.',
    },
    params: [
      {
        name: 'id',
        type: 'string',
        format: 'uuid',
        description: 'User UUID',
        example: '550e8400-e29b-41d4-a716-446655440000',
      },
    ],
    body: {
      schema: { $ref: '#/components/schemas/UpdateUserStatusRequest' },
      description: 'User status update data',
    },
    response: {
      status: 200,
      description: 'Successfully updated user status',
      schema: {
        type: 'object',
        properties: {
          data: {
            $ref: '#/components/schemas/User',
          },
        },
      },
    },
  })
  async updateUserStatus(
    @Param('id', ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(updateUserStatusSchema))
    payload: UpdateUserStatusDto
  ) {
    const updatedUser = await this.userService.updateUserStatus(
      userId,
      payload.status
    );

    // Invalidate user caches
    await this.cacheService.invalidateUserCaches(userId);

    return {
      data: updatedUser,
    };
  }

  // Delete user by ID (Admin only)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(PreventSameUserActionGuard)
  @Roles(UserRole.ADMIN)
  @ApiDocumentation({
    operation: {
      summary: 'Delete user (Admin only)',
      description:
        'Permanently delete a user account from both Clerk and the database. This action cannot be undone. Only accessible by administrators. Cannot delete own account.',
    },
    params: [
      {
        name: 'id',
        type: 'string',
        format: 'uuid',
        description: 'User UUID',
        example: '550e8400-e29b-41d4-a716-446655440000',
      },
    ],
    response: {
      status: 204,
      description: 'Successfully deleted user',
    },
  })
  async deleteUser(@Param('id', ParseUUIDPipe) userId: string) {
    await this.userService.deleteUser(userId);

    // Invalidate user caches
    await this.cacheService.invalidateUserCaches(userId);
  }
}
