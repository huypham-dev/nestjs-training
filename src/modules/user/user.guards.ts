// Dependencies
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';

// Common
import {
  AuthenticationException,
  OperationNotAllowedException,
} from '@/common/exceptions';

/**
 * Guard: Prevent user from performing action on themselves
 *
 *
 * Pure authorization - no side effects
 */
@Injectable()
export class PreventSameUserActionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    if (!user) {
      throw new AuthenticationException();
    }

    const targetId = request.params.id as string | undefined;

    if (targetId && user.id === targetId) {
      throw new OperationNotAllowedException(
        'You cannot perform this action on current user'
      );
    }

    return true;
  }
}
