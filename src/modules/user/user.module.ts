// Dependencies
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';

// Controllers
import { UserController } from './user.controller';

// Services
import { UserService } from './user.service';

// Entities
import { User } from './user.entity';

// Middlewares
import {
  ClerkAuthMiddleware,
  SyncUserMiddleware,
  CheckUserStatusMiddleware,
} from '@/common/middlewares';

// Guards
import { RolesGuard } from '@/common/guards';
import { PreventSameUserActionGuard } from './user.guards';

@Module({
  imports: [MikroOrmModule.forFeature([User])],
  controllers: [UserController],
  providers: [
    UserService,
    RolesGuard,
    PreventSameUserActionGuard,
    ClerkAuthMiddleware,
    SyncUserMiddleware,
    CheckUserStatusMiddleware,
  ],
  exports: [UserService],
})
export class UserModule {}
