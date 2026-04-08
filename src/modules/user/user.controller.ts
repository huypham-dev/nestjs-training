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
} from '@nestjs/common';
import { ApiTags, ApiSecurity } from '@nestjs/swagger';

// Common
import { ApiDocumentation } from '@/common/decorators';
import { ZodValidationPipe } from '@/common/pipes';

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

@ApiTags('Users')
@ApiSecurity('Auth')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Get all users (Admin only)
   *
   * Retrieves a paginated list of all users in the system.
   * Only administrators can access this endpoint.
   *
   * @param query - Query parameters containing offset and limit for pagination
   * @returns Paginated list of users with metadata
   *
   * @example
   * GET /users?offset=0&limit=10
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
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

  /**
   * Get current user profile
   *
   * Retrieves the profile information of the currently authenticated user.
   * The user information is automatically extracted from the JWT token.
   *
   * @param user - Current authenticated user from JWT token
   * @returns Current user profile data
   *
   * @example
   * GET /users/me
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
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

  /**
   * Update current user profile
   *
   * Updates the profile information (fullName, email) of the currently authenticated user.
   * Users can only update their own profile through this endpoint.
   *
   * @param user - Current authenticated user from JWT token
   * @param payload - Update data containing optional fullName and email fields
   * @returns Updated user profile data
   *
   * @example
   * PATCH /users/me
   * Body: { "fullName": "John Doe", "email": "john@example.com" }
   */
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

    return {
      data: updatedUser,
    };
  }

  /**
   * Get user by ID
   *
   * Retrieves a specific user's profile by their UUID.
   * Accessible to all authenticated users in the system.
   *
   * @param userId - UUID of the user to retrieve
   * @returns User profile data for the specified ID
   * @throws NotFoundException if user with given ID doesn't exist
   *
   * @example
   * GET /users/550e8400-e29b-41d4-a716-446655440000
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
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

  /**
   * Update user status (Admin only)
   *
   * Updates the status of a user account between ACTIVE and INACTIVE states.
   * When status is set to INACTIVE, the user is locked on Clerk (prevents login).
   * When status is set to ACTIVE, the user is unlocked on Clerk (allows login).
   * Only administrators can access this endpoint.
   * Administrators cannot update their own status (prevented by PreventSameUserActionGuard).
   *
   * @param userId - UUID of the user whose status to update
   * @param payload - Status update data containing the new status (ACTIVE/INACTIVE)
   * @returns Updated user profile with new status
   * @throws ForbiddenException if admin tries to update their own status
   * @throws NotFoundException if user with given ID doesn't exist
   *
   * @example
   * PATCH /users/550e8400-e29b-41d4-a716-446655440000/status
   * Body: { "status": "INACTIVE" }
   */
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
            $ref: '#/components/schemas/UserResponse',
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

    return {
      data: updatedUser,
    };
  }
}
