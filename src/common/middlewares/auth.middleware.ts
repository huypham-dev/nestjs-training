// Dependencies
import { getAuth } from '@clerk/express';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

// Common
import { AuthenticationException } from '@/common/exceptions';

// Modules
import { UserService } from '@/modules/user/user.service';

/**
 * Extract Clerk auth info, sync user with database, and attach to request
 * Creates user if doesn't exist
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly userService: UserService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const auth = getAuth(req);

    if (!auth.userId) {
      throw new AuthenticationException();
    }

    const { email, fullName, avatarUrl } = auth.sessionClaims || {};

    // Attach auth info to request
    req.auth = {
      authId: auth.userId,
      email: email as string,
      fullName: fullName as string,
    };

    try {
      // Sync user with database
      const user = await this.userService.syncUser(
        auth.userId,
        email as string,
        fullName as string,
        avatarUrl as string
      );

      req.user = user;
      next();
    } catch (error) {
      // Let exception filter handle it
      next(error);
    }
  }
}
