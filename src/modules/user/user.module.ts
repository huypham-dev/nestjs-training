// Dependencies
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';

// Controllers
import { UserController } from './user.controller';

// Services
import { UserService } from './user.service';
import { CacheService } from '@/common/services';
import { ClerkService } from '@/shared/services/clerk/clerk.service';

// Entities
import { User } from './user.entity';

// Guards
import { PreventSameUserActionGuard } from './user.guards';

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
