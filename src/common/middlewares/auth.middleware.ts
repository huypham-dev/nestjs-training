// Dependencies
import { getAuth } from '@clerk/express';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

// Common
import { AuthenticationException } from '@/common/exceptions';

// Modules
import { UserService } from '@/modules/user/user.service';

/**
 * Extract Clerk auth info and attach user from database to request
 *
 * Note: User creation is now handled by the user.created webhook event.
 * This middleware only retrieves existing users from the database.
 * If a user doesn't exist, it throws an authentication exception.
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly userService: UserService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const auth = getAuth(req);

    if (!auth.userId) {
      throw new AuthenticationException();
    }

    const { email, fullName } = auth.sessionClaims || {};

    // Attach auth info to request
    req.auth = {
      authId: auth.userId,
      email: email as string,
      fullName: fullName as string,
    };

    try {
      // Get user from database (must exist from webhook creation)
      const user = await this.userService.getUserByAuthId(auth.userId);

      if (!user) {
        throw new AuthenticationException(
          'User not found. Please contact support.'
        );
      }

      req.user = user;
      next();
    } catch (error) {
      // Let exception filter handle it
      next(error);
    }
  }
}
