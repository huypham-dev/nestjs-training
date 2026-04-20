// Dependencies
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Modules
import { PostModule } from '../post.module';

// Constants
import { QUEUE_NAMES } from '@/constants';

// Processors
import { PostPublishingProcessor } from './processors/post-publishing.processor';
import { ImageProcessingProcessor } from './processors/image-processing.processor';

// Services
import { MissedScheduleService } from './missed-schedule.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST') || 'localhost',
          port: configService.get<number>('REDIS_PORT') || 6379,
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.POST_PUBLISHING,
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.IMAGE_PROCESSING,
    }),
    PostModule,
  ],
  providers: [
    PostPublishingProcessor,
    ImageProcessingProcessor,
    MissedScheduleService,
  ],
  exports: [BullModule],
})
export class PostQueueModule {}
