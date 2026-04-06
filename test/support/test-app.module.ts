/**
 * Test Application Module for E2E Tests
 * Bypasses Clerk authentication and uses mock middleware
 */

// Dependencies
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { CacheModule } from '@nestjs/cache-manager';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

// Common
import { GlobalExceptionFilter } from '@/common/filters';
import { RolesGuard } from '@/common/guards';
import { LoggingInterceptor } from '@/common/interceptors';
import { ResponseTransformInterceptor } from '@/common/interceptors/response-transform.interceptor';
import { CacheService } from '@/common/services';

// Modules
import { CategoryModule } from '@/modules/category';
import { PostModule } from '@/modules/post';
import { UserModule } from '@/modules/user';

// Services
import { ClerkService } from '@/shared/services/clerk/clerk.service';

// Other
import { MockAuthMiddleware } from './mock-auth.middleware';
import { createDatabaseConfig } from '@/config';

// Test Middleware

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
      cache: true,
      expandVariables: true,
    }),
    MikroOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          ...createDatabaseConfig(configService),
          driver: PostgreSqlDriver,
          registerRequestContext: true,
        };
      },
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: configService.get<number>('THROTTLE_TTL', 900000),
            limit: configService.get<number>('THROTTLE_LIMIT', 100),
          },
        ],
      }),
    }),
    CacheModule.register({
      isGlobal: true,
      store: 'memory', // Use memory store but with very short TTL
      ttl: 1, // 1 millisecond - effectively disabled for tests
      max: 1, // Minimal cache size
    }),
    UserModule,
    CategoryModule,
    PostModule,
  ],
  providers: [
    CacheService,
    {
      provide: ClerkService,
      useValue: {
        lockUser: jest.fn().mockResolvedValue(undefined),
        unlockUser: jest.fn().mockResolvedValue(undefined),
        updateUser: jest.fn().mockResolvedValue(undefined),
        deleteUser: jest.fn().mockResolvedValue(undefined),
        verifyWebhook: jest.fn().mockImplementation(() => ({
          type: 'user.updated',
          data: {},
        })),
      },
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseTransformInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [UserModule, CategoryModule, PostModule, ClerkService],
})
export class TestAppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Use mock middleware instead of Clerk
    consumer.apply(MockAuthMiddleware).forRoutes('*');
  }
}
