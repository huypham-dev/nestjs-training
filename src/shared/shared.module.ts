// Dependencies
import { Global, Module } from '@nestjs/common';

// Services
import { ClerkAuthService } from './services/auth/clerk-auth.service';
import { AUTH_SERVICE } from './services/auth/auth-service.interface';
import { S3StorageService } from './services/storage/s3.service';
import { STORAGE_SERVICE } from './services/storage/storage.interface';

/**
 * Shared Module
 *
 * Provides global services that can be used across the application.
 * Uses dependency injection tokens for easy provider swapping.
 *
 * To switch providers:
 * 1. Storage: Change S3StorageService to CloudinaryService, LocalStorageService, etc.
 * 2. Auth: Change ClerkAuthService to Auth0Service, FirebaseAuthService, etc.
 * 3. No other changes needed in the app
 */

const providers = [
  // Storage provider - use STORAGE_SERVICE token for injection
  {
    provide: STORAGE_SERVICE,
    useClass: S3StorageService, // Swap: CloudinaryService, GCSService, LocalStorageService
  },
  // Auth provider - use AUTH_SERVICE token for injection
  {
    provide: AUTH_SERVICE,
    useClass: ClerkAuthService, // Swap: Auth0Service, FirebaseAuthService, SupabaseAuthService
  },
];

@Global()
@Module({
  providers: [...providers],
  exports: [...providers],
})
export class SharedModule {}
