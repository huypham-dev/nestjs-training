// Dependencies
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ElasticsearchModule } from '@nestjs/elasticsearch';

// Services
import { ClerkAuthService } from './services/auth/clerk-auth.service';
import { AUTH_SERVICE } from './services/auth/auth-service.interface';
import { S3StorageService } from './services/storage/s3.service';
import { STORAGE_SERVICE } from './services/storage/storage.interface';
import {
  ElasticsearchService,
  ELASTICSEARCH_SERVICE,
} from './services/elasticsearch';
import { PushNotificationService } from './services/push-notification/push-notification.service';
import { PUSH_NOTIFICATION_SERVICE } from './services/push-notification/push-notification.interface';

/**
 * Shared Module
 *
 * Provides global services that can be used across the application.
 * Uses dependency injection tokens for easy provider swapping.
 *
 * To switch providers:
 * 1. Storage: Change S3StorageService to CloudinaryService, LocalStorageService, etc.
 * 2. Auth: Change ClerkAuthService to Auth0Service, FirebaseAuthService, etc.
 * 3. Search: Change ElasticsearchService to OpenSearchService, AlgoliaService, etc.
 * 4. No other changes needed in the app
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
  // Search provider - use ELASTICSEARCH_SERVICE token for injection
  {
    provide: ELASTICSEARCH_SERVICE,
    useClass: ElasticsearchService,
  },
  // Push notification provider – use PUSH_NOTIFICATION_SERVICE token for injection
  {
    provide: PUSH_NOTIFICATION_SERVICE,
    useClass: PushNotificationService, // Swap: OneSignalService, ExpoService, etc.
  },
];

@Global()
@Module({
  imports: [
    ElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        node: configService.get<string>(
          'ELASTICSEARCH_NODE',
          'http://localhost:9200'
        ),
      }),
    }),
  ],
  providers: [...providers],
  exports: [...providers],
})
export class SharedModule {}
