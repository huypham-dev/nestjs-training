// Dependencies
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Modules
import { PostModule } from '@/modules/post/post.module';

// Processors
import { PostPublishingProcessor } from './processors/post-publishing.processor';
import { ImageProcessingProcessor } from './processors/image-processing.processor';

// Services
import { MissedScheduleService } from './services/missed-schedule.service';

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
      name: 'post-publishing',
    }),
    BullModule.registerQueue({
      name: 'image-processing',
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
export class QueuesModule {}
