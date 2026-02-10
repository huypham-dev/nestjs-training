// Dependencies
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { clerkMiddleware } from '@clerk/express';
import { ThrottlerModule } from '@nestjs/throttler';

// Modules
import { UserModule } from '@/modules/user';
import { CategoryModule } from '@/modules/category';

// Interceptors
import { LoggingInterceptor } from '@/common/interceptors';

// Filters
import { GlobalExceptionFilter } from '@/common/filters';

// Middlewares
import {
  ClerkAuthMiddleware,
  SyncUserMiddleware,
  CheckUserStatusMiddleware,
} from '@/common/middlewares';

// Config
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
    UserModule,
    CategoryModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
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
        SyncUserMiddleware,
        CheckUserStatusMiddleware
      )
      .forRoutes('*');
  }
}
