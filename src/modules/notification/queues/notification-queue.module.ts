// Dependencies
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';

// Constants
import { QUEUE_NAMES } from '@/constants';

// Entities
import { DeviceToken } from '../device-token.entity';

// Processor
import { PushNotificationProcessor } from './processors/push-notification.processor';

// Producer
import { NotificationProducer } from './notification.producer';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST') || 'localhost',
          port: configService.get<number>('REDIS_PORT') || 6379,
        },
      }),
    }),
    BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATION }),
    MikroOrmModule.forFeature([DeviceToken]),
  ],
  providers: [NotificationProducer, PushNotificationProcessor],
  exports: [NotificationProducer, BullModule],
})
export class NotificationQueueModule {}
