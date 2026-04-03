// Dependencies
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

// Common
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import {
  AuthenticationException,
  InactiveUserException,
} from '@/common/exceptions';

// Constants
import { UserStatus } from '@/constants';

/**
 * Guard: Check if user account is active
 * Ensures only active users can access protected routes
 */
@Injectable()
export class ActiveUserGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    if (!user) {
      throw new AuthenticationException();
    }

    if ((user.status as UserStatus) === UserStatus.INACTIVE) {
      throw new InactiveUserException('User account is inactive');
    }

    return true;
  }
}
