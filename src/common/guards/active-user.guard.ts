// Dependencies
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';

// Constants
import { UserStatus } from '@/constants/users';

// Exceptions
import {
  AuthenticationException,
  InactiveUserException,
} from '@/common/exceptions';

/**
 * Guard: Check if user account is active
 * Ensures only active users can access protected routes
 */
@Injectable()
export class ActiveUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
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
