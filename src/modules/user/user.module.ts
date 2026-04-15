// Dependencies
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

// Common
import { CacheService } from '@/common/services';

// Controllers
import { UserController } from './user.controller';

// Services
import { UserService } from './user.service';

// Guards
import { PreventSameUserActionGuard } from './user.guards';

// Gateway
import { UserStatusGateway } from './user-status.gateway';

// Entities
import { User } from './user.entity';

@Module({
  imports: [MikroOrmModule.forFeature([User])],
  controllers: [UserController],
  providers: [
    UserService,
    PreventSameUserActionGuard,
    CacheService,
    UserStatusGateway,
  ],
  exports: [UserService],
})
export class UserModule {}
