// Dependencies
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { CacheModule } from '@nestjs/cache-manager';
import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

// Common
import { GlobalExceptionFilter } from '@/common/filters';
import { LoggingInterceptor } from '@/common/interceptors';
import { AuthMiddleware, AuthProviderMiddleware } from '@/common/middlewares';
import { CacheService } from '@/common/services';

// Modules
import { CategoryModule } from '@/modules/category';
import { PostModule } from '@/modules/post';
import { UserModule } from '@/modules/user';
import { WebhookModule } from '@/modules/webhook';
import { SharedModule } from '@/shared/shared.module';

// Guards
import { ActiveUserGuard, RolesGuard } from './common/guards';

// Other
import { createDatabaseConfig } from '@/config';

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
      ttl: 30000, // 30 seconds default TTL
      max: 100, // Maximum number of items in cache
    }),
    UserModule,
    CategoryModule,
    PostModule,
    WebhookModule,
    SharedModule,
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
      .apply(AuthProviderMiddleware, AuthMiddleware)
      .exclude(
        { path: 'webhooks/clerk', method: RequestMethod.POST },
        { path: 'webhooks/(.*)', method: RequestMethod.ALL }
      )
      .forRoutes('*');
  }
}
