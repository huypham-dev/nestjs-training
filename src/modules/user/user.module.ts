// Dependencies
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

// Common
import { CacheService } from '@/common/services';

// Controllers
import { UserController } from './user.controller';

// Services
import { UserService } from './user.service';
import { ClerkService } from '@/shared/services/clerk/clerk.service';

// Guards
import { PreventSameUserActionGuard } from './user.guards';

// Entities
import { User } from './user.entity';

@Module({
  imports: [MikroOrmModule.forFeature([User])],
  controllers: [UserController],
  providers: [
    UserService,
    PreventSameUserActionGuard,
    CacheService,
    ClerkService,
  ],
  exports: [UserService],
})
export class UserModule {}
