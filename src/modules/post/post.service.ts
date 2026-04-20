// Dependencies
import { EntityManager, EntityRepository, FilterQuery } from '@mikro-orm/core';
import { InjectRepository, logger } from '@mikro-orm/nestjs';
import { InjectQueue } from '@nestjs/bull';
import { Inject, Injectable } from '@nestjs/common';
import type { Queue } from 'bull';

// Common
import {
  AuthorizationException,
  ResourceNotFoundException,
} from '@/common/exceptions';
import { SuccessResponse } from '@/common/interfaces';
import { CacheService } from '@/common/services';

// Modules
import { Category } from '@/modules/category/category.entity';
import { User } from '@/modules/user/user.entity';

// Services
import type { IStorageService } from '@/shared/services';
import { STORAGE_SERVICE } from '@/shared/services';

// Entities
import { Post } from './post.entity';

// DTOs
import { PostQueryDto, UpdatePostDto } from './post.dto';

// Constants
import { JOB_NAMES, PostStatus, QUEUE_NAMES } from '@/constants';

@Injectable()
export class PostService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: EntityRepository<Post>,
    @InjectRepository(Category)
    private readonly categoryRepository: EntityRepository<Category>,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    private readonly em: EntityManager,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,
    @InjectQueue(QUEUE_NAMES.POST_PUBLISHING)
    private readonly postPublishingQueue: Queue,
    @InjectQueue(QUEUE_NAMES.IMAGE_PROCESSING)
    private readonly imageProcessingQueue: Queue,
    private readonly cacheService: CacheService
  ) {}

  /**
   * Get posts with visibility rules:
   * - Returns PUBLISHED posts from all users
   * - Returns current user's DRAFT posts only
   * - Use status query param to filter (e.g., status=draft shows current user's drafts)
   */
  async getAllPosts(
    options: PostQueryDto,
    currentUserId: string,
    currentUserRole: 'admin' | 'user'
  ): Promise<SuccessResponse<Post[]>> {
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 10;

    // Build query based on filtering rules
    const where = this.buildPostQuery(
      options.status,
      currentUserId,
      currentUserRole,
      undefined,
      options.search
    );

    const [posts, total] = await this.postRepository.findAndCount(where, {
      offset,
      limit,
      orderBy: { createdAt: 'DESC' },
      populate: ['user', 'categories'],
    });

    return {
      data: posts,
      meta: {
        pagination: {
          offset,
          limit,
          total,
        },
      },
    };
  }

  /**
   * Get posts by a specific user with visibility rules:
   * - Owner can see all their posts (DRAFT + PUBLISHED)
   * - Others can only see PUBLISHED posts
   * Supports filtering by status query parameter
   */
  async getPostsByUserId(
    targetUserId: string,
    currentUserId: string,
    currentUserRole: 'admin' | 'user',
    options: PostQueryDto
  ): Promise<SuccessResponse<Post[]>> {
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 10;

    // Check if user exists
    const userExists = await this.userRepository.count({ id: targetUserId });
    if (!userExists) {
      throw new ResourceNotFoundException(
        `User with ID '${targetUserId}' not found`
      );
    }

    const isOwner = targetUserId === currentUserId;

    // Special case: non-owner requesting DRAFT posts
    // Return empty results immediately
    if (options.status === PostStatus.DRAFT && !isOwner) {
      return {
        data: [],
      };
    }

    // Build query using shared buildPostQuery method
    const where = this.buildPostQuery(
      options.status,
      currentUserId,
      currentUserRole,
      targetUserId,
      options.search
    );

    const [posts, total] = await this.postRepository.findAndCount(where, {
      offset,
      limit,
      orderBy: { createdAt: 'DESC' },
      populate: ['user', 'categories'],
    });

    return {
      data: posts,
      ...(total && {
        meta: {
          pagination: {
            offset,
            limit,
            total,
          },
        },
      }),
    };
  }

  /**
   * Create a new post
   * Post is created as DRAFT by default
   * Images are processed asynchronously in background queue
   */
  async createPost(
    userId: string,
    data: { title: string; content: string; categoryIds: string[] },
    imageFile?: Express.Multer.File
  ): Promise<Post> {
    // Validate categories exist
    const categories = await this.getValidCategories(data.categoryIds);

    // Create post without images first (for fast response)
    const post = this.postRepository.create({
      title: data.title,
      content: data.content,
      user: userId,
      imageUrl: null,
      imageThumbnailUrl: null,
    });

    // Add categories (if any)
    if (categories.length > 0) {
      categories.forEach((category) => {
        post.categories.add(category);
      });
    }

    // Persist to database
    await this.em.persist(post).flush();

    // Queue image processing if image provided (async - non-blocking)
    if (imageFile) {
      try {
        await this.queueImageProcessing(post.id, imageFile);
        logger.log(
          `Post ${post.id} created. Image processing queued (will be available shortly).`
        );
      } catch (error) {
        logger.error(
          `Failed to queue image processing for post ${post.id}: ${error.message}`
        );
        // Don't fail the request - post is already created
      }
    }

    // Load relations for response
    await this.em.populate(post, ['user', 'categories']);

    return post;
  }

  /**
   * Get a single post by ID
   * - Anyone can view PUBLISHED posts
   * - Only owner can view DRAFT posts
   */
  async getPostById(postId: string, currentUserId: string): Promise<Post> {
    const post = await this.postRepository.findOne(
      { id: postId },
      { populate: ['user', 'categories'] }
    );

    if (!post) {
      throw new ResourceNotFoundException(`Post with ID '${postId}' not found`);
    }

    // Check visibility rules
    // If post is DRAFT, only owner can view
    const isOwner = post.user.id === currentUserId;

    if ((post.status as PostStatus) === PostStatus.DRAFT && !isOwner) {
      throw new AuthorizationException(
        'You do not have permission to view this post'
      );
    }

    return post;
  }
  /**
   *  Update a post by ID
   *  - Authorization checked by PostOwnerGuard
   */
  async updatePost(
    postId: string,
    data: UpdatePostDto,
    imageFile?: Express.Multer.File
  ): Promise<Post> {
    const post = await this.postRepository.findOne(
      { id: postId },
      { populate: ['user', 'categories'] }
    );

    if (!post) {
      throw new ResourceNotFoundException(`Post with ID '${postId}' not found`);
    }

    // Handle image update
    if (imageFile) {
      // Fire-and-forget: delete old images in background (non-blocking)
      const oldImageUrl = post.imageUrl;
      const oldThumbnailUrl = post.imageThumbnailUrl;

      if (oldImageUrl || oldThumbnailUrl) {
        this.storageService
          .deleteImageByUrls(oldImageUrl, oldThumbnailUrl)
          .catch((error) => {
            logger.error(
              `Failed to delete old images for post ${postId}: ${error.message}`
            );
          });
      }

      // Clear old image URLs immediately
      post.imageUrl = null;
      post.imageThumbnailUrl = null;

      // Queue image processing (async - non-blocking)
      try {
        await this.queueImageProcessing(postId, imageFile);
        logger.log(
          `Queued image processing for post ${postId} update. Images will be available shortly.`
        );
      } catch (error) {
        logger.error(
          `Failed to queue image processing for post ${postId}: ${error.message}`
        );
        // Don't fail the request - other fields will still be updated
      }
    }

    // Update fields
    if (data.title !== undefined) {
      post.title = data.title;
    }
    if (data.content !== undefined) {
      post.content = data.content;
    }
    if (data.status !== undefined) {
      // If post was SCHEDULED and status is changing, remove job from queue
      if (
        (post.status as PostStatus) === PostStatus.SCHEDULED &&
        data.status !== PostStatus.SCHEDULED
      ) {
        await this.removeScheduledJob(postId);
        logger.log(
          `Removed scheduled job for post ${postId} due to status change to ${data.status}`
        );
      }

      post.status = data.status;
    }

    // Update categories if provided
    if (data.categoryIds !== undefined) {
      // Validate categories exist
      const categories = await this.getValidCategories(data.categoryIds);

      // Clear existing categories
      post.categories.removeAll();

      // Add new categories
      categories.forEach((category) => {
        post.categories.add(category);
      });
    }

    // Persist changes
    await this.em.flush();

    return post;
  }

  /**
   * Delete a post by ID
   * - Authorization checked by PostOwnerOrAdminGuard
   */
  async deletePost(postId: string): Promise<void> {
    const post = await this.postRepository.findOne(
      { id: postId },
      { populate: ['categories'] }
    );

    if (!post) {
      throw new ResourceNotFoundException(`Post with ID '${postId}' not found`);
    }

    // Delete images from S3 if they exist
    try {
      if (post.imageUrl || post.imageThumbnailUrl) {
        await this.storageService.deleteImageByUrls(
          post.imageUrl,
          post.imageThumbnailUrl
        );
      }
    } catch (error) {
      // Log error but continue with post deletion
      console.error('Failed to delete images from S3:', error);
    }

    // Remove all categories from the post to avoid FK constraint error
    post.categories.removeAll();
    await this.em.flush();

    // Delete the post
    this.em.remove(post);
    await this.em.flush();
  }

  /**
   * Queue image processing job (async alternative)
   * Creates post immediately and processes image in background
   * Uses temporary file storage to avoid Redis memory overhead
   */
  async queueImageProcessing(
    postId: string,
    imageFile: Express.Multer.File
  ): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');

    // Create temp directory if not exists
    const tempDir = path.join(os.tmpdir(), 'post-images');
    await fs.mkdir(tempDir, { recursive: true });

    // Save to temp file with unique name
    const timestamp = Date.now();
    const tempFilename = `${postId}-${timestamp}-${imageFile.originalname}`;
    const tempFilePath = path.join(tempDir, tempFilename);

    await fs.writeFile(tempFilePath, imageFile.buffer);

    logger.log(`Saved temp image for post ${postId} at: ${tempFilePath}`);

    await this.imageProcessingQueue.add(
      JOB_NAMES.PROCESS_POST_IMAGE,
      {
        postId,
        tempFilePath, // Only store file path (not image data)
        originalFilename: imageFile.originalname,
        mimetype: imageFile.mimetype,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true, // Clean up job data after success
        removeOnFail: false, // Keep failed jobs for debugging
      }
    );

    logger.log(
      `Queued image processing for post ${postId} (temp file: ${tempFilePath})`
    );
  }

  /**
   * Update post with processed images (called by queue processor)
   */
  async updatePostImages(
    postId: string,
    imageUrl: string,
    imageThumbnailUrl: string
  ): Promise<void> {
    const em = this.em.fork();
    const postRepo = em.getRepository(Post);

    const post = await postRepo.findOne({ id: postId });

    if (!post) {
      logger.warn(`Post ${postId} not found when updating images`);
      return;
    }

    post.imageUrl = imageUrl;
    post.imageThumbnailUrl = imageThumbnailUrl;

    await em.flush();

    // Invalidate post cache so next GET returns updated image URLs
    await this.cacheService.invalidatePostCaches();

    logger.log(`Updated images for post ${postId}`);
  }

  private async getValidCategories(
    categoryIds?: string[]
  ): Promise<Category[]> {
    if (!categoryIds || categoryIds.length === 0) return [];

    const categories = await this.categoryRepository.find({
      id: { $in: categoryIds },
    });

    if (categories.length !== categoryIds.length) {
      const foundIds = categories.map((c) => c.id);
      const missingIds = categoryIds.filter((id) => !foundIds.includes(id));
      throw new ResourceNotFoundException(
        `Categories not found: ${missingIds.join(', ')}`
      );
    }

    return categories;
  }

  /**
   * Build query filter based on status and current user
   * @param status - Optional status filter (PUBLISHED or DRAFT)
   * @param currentUserId - ID of the current authenticated user
   * @param currentUserRole - Role of the current user (admin or regular)
   * @param targetUserId - Optional: Filter posts by this specific user
   * @param search - Optional: Search posts by title (case-insensitive)
   */
  private buildPostQuery(
    status: PostStatus | undefined,
    currentUserId: string,
    currentUserRole: 'admin' | 'user',
    targetUserId?: string,
    search?: string
  ): FilterQuery<Post> {
    const where: FilterQuery<Post> = {};

    // Normalize search: treat empty string as undefined
    const normalizedSearch =
      search && search.trim().length > 0 ? search.trim() : undefined;

    // Add user filter if targetUserId is provided
    if (targetUserId) {
      where.user = targetUserId;
    }

    // Add search filter if search query is provided
    if (normalizedSearch) {
      where.title = { $ilike: `%${normalizedSearch}%` };
    }

    // Case 1: No status provided
    if (!status) {
      if (targetUserId) {
        // For specific user posts:
        // - Owner sees all posts (DRAFT + PUBLISHED)
        // - Others see only PUBLISHED posts
        const isOwner = targetUserId === currentUserId;
        if (!isOwner) {
          where.status = PostStatus.PUBLISHED;
        }
      } else {
        // For all posts:
        // - All users can see PUBLISHED posts and their own DRAFT posts
        // If search is applied, need to include it in $or conditions
        if (normalizedSearch) {
          where.$or = [
            {
              status: PostStatus.PUBLISHED,
              title: { $ilike: `%${normalizedSearch}%` },
            },
            {
              status: PostStatus.DRAFT,
              user: currentUserId,
              title: { $ilike: `%${normalizedSearch}%` },
            },
          ];
          // Remove title from top level since it's in $or
          delete where.title;
        } else {
          where.$or = [
            { status: PostStatus.PUBLISHED },
            { status: PostStatus.DRAFT, user: currentUserId },
          ];
        }
      }
      return where;
    }

    // Case 2: status = PUBLISHED
    // Return all PUBLISHED posts
    if (status === PostStatus.PUBLISHED) {
      where.status = PostStatus.PUBLISHED;
      return where;
    }

    // Case 3: status = DRAFT
    if (status === PostStatus.DRAFT) {
      where.status = PostStatus.DRAFT;
      // Only show current user's DRAFT posts
      if (!targetUserId) {
        where.user = currentUserId;
      }
      return where;
    }

    // Fallback (should not reach here)
    return where;
  }

  /**
   * Schedule a post for publishing
   * - Post must not be in PUBLISHED status (can schedule from DRAFT/SCHEDULED/CANCELLED)
   * - publishAt must be in the future
   */
  async schedulePost(postId: string, publishAt: Date): Promise<Post> {
    const post = await this.postRepository.findOne(
      { id: postId },
      { populate: ['user', 'categories'] }
    );

    if (!post) {
      throw new ResourceNotFoundException(`Post with ID '${postId}' not found`);
    }

    // Validate post is valid to schedule
    if ((post.status as PostStatus) === PostStatus.PUBLISHED) {
      throw new AuthorizationException(
        `Post must not be in PUBLISHED status to schedule`
      );
    }

    // Validate publishAt is in the future
    const now = new Date();
    if (publishAt <= now) {
      throw new AuthorizationException('Publish time must be in the future');
    }

    // Update post status and publishAt
    post.status = PostStatus.SCHEDULED;
    post.publishAt = publishAt;

    await this.em.flush();

    // Queue the publishing job
    const delay = publishAt.getTime() - now.getTime();
    await this.postPublishingQueue.add(
      JOB_NAMES.PUBLISH_POST,
      { postId },
      {
        delay,
        jobId: `publish-post-${postId}`, // Prevent duplicate jobs
        removeOnComplete: true,
        attempts: 3, // Retry up to 3 times if job fails
        backoff: {
          type: 'exponential', // Exponential backoff: 1s, 2s, 4s
          delay: 1000, // Start with 1 second delay
        },
      }
    );

    logger.log(
      `Scheduled post ${postId} for publishing at ${publishAt.toISOString()} (with 3 retry attempts)`
    );

    return post;
  }

  /**
   * Cancel a scheduled post
   * - Post must be in SCHEDULED status
   */
  async cancelScheduledPost(postId: string): Promise<Post> {
    const post = await this.postRepository.findOne(
      { id: postId },
      { populate: ['user', 'categories'] }
    );

    if (!post) {
      throw new ResourceNotFoundException(`Post with ID '${postId}' not found`);
    }

    // Validate post is in SCHEDULED status
    if ((post.status as PostStatus) !== PostStatus.SCHEDULED) {
      throw new AuthorizationException(
        `Post must be in SCHEDULED status to cancel (current: ${post.status})`
      );
    }

    // Update post status
    post.status = PostStatus.DRAFT;
    post.cancelledAt = new Date();
    post.publishAt = null; // Clear publishAt since it's cancelled

    await this.em.flush();

    // Remove the job from queue
    const jobId = `publish-post-${postId}`;
    const job = await this.postPublishingQueue.getJob(jobId);

    if (job) {
      await job.remove();
      logger.log(`Removed publishing job for post ${postId}`);
    }

    return post;
  }

  /**
   * Publish a scheduled post (called by queue processor)
   * - Post must be in SCHEDULED status
   * - Uses forked EntityManager for async context safety
   */
  async publishScheduledPost(postId: string): Promise<Post> {
    // Fork EntityManager for async context (Bull queue processor)
    const em = this.em.fork();
    const postRepo = em.getRepository(Post);

    const post = await postRepo.findOne(
      { id: postId },
      { populate: ['user', 'categories'] }
    );

    if (!post) {
      throw new ResourceNotFoundException(`Post with ID '${postId}' not found`);
    }

    // Validate post is in SCHEDULED status (idempotency)
    if ((post.status as PostStatus) !== PostStatus.SCHEDULED) {
      logger.warn(
        `Cannot publish post ${postId} - not in SCHEDULED status (current: ${post.status})`
      );
      return post;
    }

    // Update post to PUBLISHED
    post.status = PostStatus.PUBLISHED;
    post.publishedAt = new Date();
    post.publishAt = null;

    await em.flush();

    logger.log(`Published scheduled post ${postId}`);

    return post;
  }

  /**
   * Remove scheduled job from queue (helper method)
   * @private
   */
  private async removeScheduledJob(postId: string): Promise<void> {
    const jobId = `publish-post-${postId}`;
    const job = await this.postPublishingQueue.getJob(jobId);

    if (job) {
      await job.remove();
      logger.log(`Removed scheduled job ${jobId} from queue`);
    }
  }
}
