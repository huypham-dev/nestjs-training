// Dependencies
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { EntityManager } from '@mikro-orm/core';
import type { Queue } from 'bull';

// Entities
import { Post } from '../post.entity';

// Constants
import { PostStatus, QUEUE_NAMES } from '@/constants';

@Injectable()
export class MissedScheduleService implements OnModuleInit {
  private readonly logger = new Logger(MissedScheduleService.name);

  constructor(
    private readonly em: EntityManager,
    @InjectQueue(QUEUE_NAMES.POST_PUBLISHING)
    private readonly postPublishingQueue: Queue
  ) {}

  /**
   * Run on application startup to recover missed scheduled posts
   */
  async onModuleInit() {
    this.logger.log('Checking for missed scheduled posts...');
    await this.recoverMissedSchedules();
  }

  /**
   * Find and publish posts that were scheduled but missed their publish time
   */
  async recoverMissedSchedules(): Promise<void> {
    const em = this.em.fork();
    const postRepo = em.getRepository(Post);

    try {
      // Find all SCHEDULED posts where publishAt <= now
      const now = new Date();
      const missedPosts = await postRepo.find({
        status: PostStatus.SCHEDULED,
        publishAt: { $lte: now },
      });

      if (missedPosts.length === 0) {
        this.logger.log('No missed scheduled posts found');
        return;
      }

      this.logger.log(
        `Found ${missedPosts.length} missed scheduled post(s), publishing now...`
      );

      // Publish each missed post immediately
      for (const post of missedPosts) {
        try {
          // Update post to PUBLISHED
          post.status = PostStatus.PUBLISHED;
          post.publishedAt = new Date();

          await em.flush();

          this.logger.log(
            `Published missed post ${post.id} (was scheduled for ${post.publishAt?.toISOString()})`
          );
        } catch (error) {
          this.logger.error(
            `Failed to publish missed post ${post.id}: ${error.message}`
          );
        }
      }

      this.logger.log('Missed schedule recovery completed');
    } catch (error) {
      this.logger.error(
        `Error during missed schedule recovery: ${error.message}`,
        error.stack
      );
    }
  }
}
