// Dependencies
import { clerkMiddleware } from '@clerk/express';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';

/**
 * Authentication Provider Middleware
 *
 * Abstract middleware that wraps the authentication provider (Clerk, Auth0, Firebase, etc.).
 * This allows easy switching between different authentication providers without changing
 * the application code in app.module.ts.
 *
 * To switch providers:
 * 1. Replace the implementation in this file
 * 2. Update AuthMiddleware to extract user info from the new provider
 * 3. No changes needed in app.module.ts
 */
@Injectable()
export class AuthProviderMiddleware implements NestMiddleware {
  private readonly clerkMiddleware: any;

  constructor(private readonly configService: ConfigService) {
    // Initialize Clerk middleware
    // To use a different provider, replace this initialization
    this.clerkMiddleware = clerkMiddleware({
      publishableKey: this.configService.get<string>('CLERK_PUBLISHABLE_KEY'),
      secretKey: this.configService.get<string>('CLERK_SECRET_KEY'),
    });
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Delegate to the current authentication provider middleware
    // For Clerk, we use clerkMiddleware
    // For Auth0, you would use auth0Middleware, etc.
    this.clerkMiddleware(req, res, next);
  }
}
