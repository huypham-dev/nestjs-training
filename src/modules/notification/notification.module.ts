// Dependencies
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';

// Entities
import { DeviceToken } from './device-token.entity';

// User entity (for FK + repository injection)
import { User } from '@/modules/user/user.entity';

// Service
import { NotificationService } from './notification.service';

// Controller
import { NotificationController } from './notification.controller';

// Queue module (contains producer + processor)
import { NotificationQueueModule } from './queues/notification-queue.module';

@Module({
  imports: [
    MikroOrmModule.forFeature([DeviceToken, User]),
    NotificationQueueModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
