// Dependencies
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';

// Guards
import { PreventSameUserActionGuard } from './user.guards';

// Pipes
import { ZodValidationPipe } from '@/common/pipes';

// Services
import { UserService } from './user.service';

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

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // Get all users (admin only)
  @Get()
  @Roles(UserRole.ADMIN)
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
  getCurrentUser(@CurrentUser() user: User) {
    return {
      data: user,
    };
  }

  // Update current user information
  @Patch('me')
  async updateCurrentUser(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(updateCurrentUserSchema))
    payload: updateCurrentUserDto
  ) {
    const updatedUser = await this.userService.updateUserByAuthId(
      user.authId,
      payload
    );

    return {
      data: updatedUser,
    };
  }

  @Patch(':id/status')
  @UseGuards(PreventSameUserActionGuard)
  @Roles(UserRole.ADMIN)
  async updateUserStatus(
    @Param('id', ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(updateUserStatusSchema))
    payload: UpdateUserStatusDto
  ) {
    await this.userService.updateUserStatus(userId, payload.status);

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
