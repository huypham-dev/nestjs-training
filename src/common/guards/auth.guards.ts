// Dependencies
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

// Common
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import {
  AuthenticationException,
  AuthorizationException,
} from '@/common/exceptions';

// Constants
import { UserRole } from '@/constants';

const ROLES_KEY = 'roles';

/**
 * Guard: Check if user has required role(s)
 * Pure authorization - no side effects
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles || roles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    if (!user) {
      throw new AuthenticationException();
    }

    if (!roles.includes(user.role)) {
      throw new AuthorizationException();
    }

    return true;
  }
}
