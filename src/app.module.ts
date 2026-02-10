// Dependencies
import { APP_FILTER } from '@nestjs/core';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { clerkMiddleware } from '@clerk/express';

// Modules
import { UserModule } from '@/modules/user';

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
    UserModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
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
