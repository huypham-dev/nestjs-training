// Dependencies
import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bull';

// Services
import type { IStorageService } from '@/shared/services';
import { STORAGE_SERVICE } from '@/shared/services';
import { PostService } from '@/modules/post/post.service';

interface ImageProcessingJobData {
  postId: string;
  tempFilePath: string; // Path to temporary file on disk
  originalFilename: string;
  mimetype: string;
}

interface ProcessedImageResult {
  imageUrl: string;
  imageThumbnailUrl: string;
}

@Processor('image-processing')
export class ImageProcessingProcessor {
  private readonly logger = new Logger(ImageProcessingProcessor.name);

  constructor(
    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,
    private readonly postService: PostService
  ) {}

  @Process('process-post-image')
  async handleImageProcessing(
    job: Job<ImageProcessingJobData>
  ): Promise<ProcessedImageResult> {
    const { postId, tempFilePath } = job.data;
    const attemptNumber = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts || 1;

    this.logger.log(
      `Processing image for post: ${postId} (attempt ${attemptNumber}/${maxAttempts})`
    );

    try {
      // Read image from temporary file (much lighter on Redis)
      const imageBuffer = await this.readTempFile(tempFilePath);

      this.logger.log(`Image loaded for post ${postId}, uploading to S3...`);

      // Use storageService.uploadImageWithThumbnail() which handles:
      // - Resize original image
      // - Generate thumbnail with Sharp internally
      // - Upload both to S3 in parallel
      const { original, thumbnail } =
        await this.storageService.uploadImageWithThumbnail(
          imageBuffer,
          job.data.originalFilename
        );

      this.logger.log(
        `Successfully processed and uploaded image for post ${postId}`
      );

      // Update post with image URLs
      await this.postService.updatePostImages(
        postId,
        original.url,
        thumbnail.url
      );

      // Clean up temp file after successful upload
      await this.cleanupTempFile(tempFilePath);

      return {
        imageUrl: original.url,
        imageThumbnailUrl: thumbnail.url,
      };
    } catch (error) {
      this.logger.error(
        `Failed to process image for post ${postId} on attempt ${attemptNumber}: ${error.message}`,
        error.stack
      );

      // Clean up temp file on final failure
      if (attemptNumber >= maxAttempts) {
        this.logger.error(
          `FINAL FAILURE: Image processing for post ${postId} failed after ${maxAttempts} attempts`
        );
        await this.cleanupTempFile(tempFilePath);
      }

      throw error;
    }
  }

  /**
   * Read image from temporary file
   */
  private async readTempFile(filePath: string): Promise<Buffer> {
    const fs = await import('fs/promises');

    try {
      const buffer = await fs.readFile(filePath);
      this.logger.log(`Read temp file: ${filePath} (${buffer.length} bytes)`);
      return buffer;
    } catch (error) {
      this.logger.error(`Failed to read temp file: ${filePath}`, error.stack);
      throw new Error(`Failed to read temporary image file: ${error.message}`);
    }
  }

  /**
   * Clean up temporary file after processing
   */
  private async cleanupTempFile(filePath: string): Promise<void> {
    const fs = await import('fs/promises');

    try {
      await fs.unlink(filePath);
      this.logger.log(`Cleaned up temp file: ${filePath}`);
    } catch (error) {
      // Don't fail the job if cleanup fails - just log it
      this.logger.warn(
        `Failed to cleanup temp file: ${filePath} - ${error.message}`
      );
    }
  }

  @OnQueueFailed()
  handleFailedJob(job: Job<ImageProcessingJobData>, error: Error) {
    const { postId } = job.data;

    this.logger.error(
      `Image processing job permanently failed for post ${postId} after ${job.attemptsMade} attempts`
    );
    this.logger.error(`Error: ${error.message}`, error.stack);

    this.logger.warn(
      `Post ${postId} created without images. Manual intervention may be required.`
    );
  }
}
