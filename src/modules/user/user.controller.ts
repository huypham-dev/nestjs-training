// Dependencies
import {
  Body,
  Controller,
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
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';

// Common decorators
import { ApiDocumentation } from '@/common/decorators';

// Guards
import { PreventSameUserActionGuard } from './user.guards';

// Pipes
import { ZodValidationPipe } from '@/common/pipes';

// Services
import { UserService } from './user.service';
import { CacheService } from '@/common/services';

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
  UserResponse,
} from './user.dto';

// Decorators
import { CurrentUser, Roles } from './user.decorators';

// Constants
import { UserRole } from '@/constants/users';
import { CACHE_KEYS } from '@/constants';

@ApiTags('Users')
@ApiSecurity('clerk-auth')
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
  @UseInterceptors(CacheInterceptor)
  @CacheKey(CACHE_KEYS.USERS_LIST)
  @CacheTTL(60000) // 60 seconds
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
      data: result.data.map((user) => this.toUserResponse(user)),
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
    const updatedUser = await this.userService.updateUserByAuthId(
      user.authId,
      payload
    );

    // Invalidate user caches
    await this.cacheService.invalidateUserCaches(user.id);

    return {
      data: updatedUser,
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
        'Update the status of a user account (ACTIVE/INACTIVE). Only accessible by administrators. Cannot update own status.',
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
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
            },
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
    await this.userService.updateUserStatus(userId, payload.status);

    // Invalidate user caches
    await this.cacheService.invalidateUserCaches(userId);

    return {
      data: {
        success: true,
      },
    };
  }

  private toUserResponse(user: User): UserResponse {
    return {
      id: user.id,
      authId: user.authId,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
