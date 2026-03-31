// Dependencies
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { clerkMiddleware } from '@clerk/express';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';

// Modules
import { UserModule } from '@/modules/user';
import { CategoryModule } from '@/modules/category';
import { PostModule } from '@/modules/post';

// Interceptors
import { LoggingInterceptor } from '@/common/interceptors';

// Filters
import { GlobalExceptionFilter } from '@/common/filters';

// Services
import { CacheService } from '@/common/services';

// Middlewares
import { ClerkAuthMiddleware, SyncUserMiddleware } from '@/common/middlewares';

// Config
import { createDatabaseConfig } from '@/config';
import { ActiveUserGuard, RolesGuard } from './common/guards';

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
            ttl: configService.get<number>('THROTTLE_TTL', 900000), // 15 minutes
            limit: configService.get<number>('THROTTLE_LIMIT', 100), // 100 requests per 15 minutes
          },
        ],
      }),
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 60000, // 60 seconds default TTL
      max: 100, // Maximum number of items in cache
    }),
    UserModule,
    CategoryModule,
    PostModule,
  ],
  providers: [
    CacheService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ActiveUserGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  constructor(private readonly configService: ConfigService) {}

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        clerkMiddleware({
          publishableKey: this.configService.get<string>(
            'CLERK_PUBLISHABLE_KEY'
          ),
          secretKey: this.configService.get<string>('CLERK_SECRET_KEY'),
        }),
        ClerkAuthMiddleware,
        SyncUserMiddleware
      )
      .forRoutes('*');
  }
}
