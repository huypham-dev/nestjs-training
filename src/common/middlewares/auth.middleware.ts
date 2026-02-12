// Dependencies
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { getAuth } from '@clerk/express';

// Services
import { UserService } from '@/modules/user/user.service';

// Constants
import { UserStatus } from '@/constants/users';

// Exceptions
import {
  AuthenticationException,
  InactiveUserException,
} from '@/common/exceptions';

/**
 * Extract Clerk auth info and attach to request.auth
 */
@Injectable()
export class ClerkAuthMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const auth = getAuth(req);

    if (!auth.userId) {
      throw new AuthenticationException();
    }

    const { email, fullName } = auth.sessionClaims || {};

    if (auth.userId) {
      req.auth = {
        authId: auth.userId,
        email: email as string,
        fullName: fullName as string,
      };
    }

    next();
  }
}

/**
 * Sync user with database and attach to request.user
 * Creates user if doesn't exist
 */
@Injectable()
export class SyncUserMiddleware implements NestMiddleware {
  constructor(private readonly userService: UserService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const auth = req.auth;

    if (!auth?.authId) {
      throw new AuthenticationException();
    }

    try {
      const user = await this.userService.syncUser(
        auth.authId,
        auth.email,
        auth.fullName
      );

      req.user = user;
      next();
    } catch (error) {
      // Let exception filter handle it
      next(error);
    }
  }
}

/**
 * Check if user account is active
 */
@Injectable()
export class CheckUserStatusMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const user = req.user;

    if (!user) {
      throw new AuthenticationException();
    }

    if ((user.status as UserStatus) === UserStatus.INACTIVE) {
      throw new InactiveUserException('User account is inactive');
    }

    next();
  }
}
