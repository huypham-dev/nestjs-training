import { UserRole } from '@/constants/users';
import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Request } from 'express';

export const ROLES_KEY = 'roles';

// Custom decorator to specify required roles for a route
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// Custom decorator to get current authenticated user from request
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user;
  }
);
