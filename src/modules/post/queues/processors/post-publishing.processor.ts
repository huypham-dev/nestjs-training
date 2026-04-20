// Dependencies
import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';

// Services
import { PostService } from '../../post.service';

// Constants
import { JOB_NAMES, QUEUE_NAMES } from '@/constants';

@Processor(QUEUE_NAMES.POST_PUBLISHING)
export class PostPublishingProcessor {
  private readonly logger = new Logger(PostPublishingProcessor.name);

  constructor(private readonly postService: PostService) {}

  @Process(JOB_NAMES.PUBLISH_POST)
  async handlePublishPost(job: Job<{ postId: string }>): Promise<void> {
    const { postId } = job.data;
    const attemptNumber = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts || 1;

    this.logger.log(
      `Processing publish job for post: ${postId} (attempt ${attemptNumber}/${maxAttempts})`
    );

    try {
      // Publish the post (handles its own validation and DB operations)
      await this.postService.publishScheduledPost(postId);

      this.logger.log(
        `Successfully published post: ${postId} on attempt ${attemptNumber}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish post ${postId} on attempt ${attemptNumber}: ${error.message}`,
        error.stack
      );

      // Log if this was the final attempt
      if (attemptNumber >= maxAttempts) {
        this.logger.error(
          `FINAL FAILURE: Post ${postId} failed after ${maxAttempts} attempts. Manual intervention required.`
        );
      }

      throw error; // Re-throw to trigger Bull's retry mechanism
    }
  }

  /**
   * Handle permanently failed jobs (after all retries exhausted)
   */
  @OnQueueFailed()
  handleFailedJob(job: Job<{ postId: string }>, error: Error) {
    const { postId } = job.data;

    this.logger.error(
      `Job permanently failed for post ${postId} after ${job.attemptsMade} attempts`
    );
    this.logger.error(`Error: ${error.message}`, error.stack);

    this.logger.warn(
      `Post ${postId} remains in SCHEDULED status. Manual review required.`
    );
  }
}
