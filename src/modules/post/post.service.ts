// Dependencies
import { EntityManager, EntityRepository, FilterQuery } from '@mikro-orm/core';
import { InjectRepository, logger } from '@mikro-orm/nestjs';
import { Inject, Injectable } from '@nestjs/common';

// Common
import {
  AuthorizationException,
  ResourceNotFoundException,
} from '@/common/exceptions';
import { SuccessResponse } from '@/common/interfaces';

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
import { PostStatus } from '@/constants';

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
    private readonly storageService: IStorageService
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
   */
  async createPost(
    userId: string,
    data: { title: string; content: string; categoryIds: string[] },
    imageFile?: Express.Multer.File
  ): Promise<Post> {
    // Validate categories exist
    const categories = await this.getValidCategories(data.categoryIds);

    // Process image if provided
    let imageUrl: string | undefined;
    let imageThumbnailUrl: string | undefined;

    if (imageFile) {
      try {
        const imageUrls = await this.processAndUploadImage(imageFile);
        imageUrl = imageUrls.imageUrl;
        imageThumbnailUrl = imageUrls.imageThumbnailUrl;
      } catch (error) {
        throw new Error(`Failed to process image: ${error.message}`);
      }
    }

    // Create post
    const post = this.postRepository.create({
      title: data.title,
      content: data.content,
      user: userId,
      imageUrl,
      imageThumbnailUrl,
    });

    // Add categories (if any)
    if (categories.length > 0) {
      categories.forEach((category) => {
        post.categories.add(category);
      });
    }

    // Persist to database
    await this.em.persist(post).flush();

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
      try {
        // Delete old images if they exist
        if (post.imageUrl || post.imageThumbnailUrl) {
          await this.storageService.deleteImageByUrls(
            post.imageUrl,
            post.imageThumbnailUrl
          );
        }

        // Process and upload new image
        const imageUrls = await this.processAndUploadImage(imageFile);

        post.imageUrl = imageUrls.imageUrl;
        post.imageThumbnailUrl = imageUrls.imageThumbnailUrl;
      } catch (error) {
        console.error('❌ Image upload error:', error);
        throw new Error(`Failed to update image: ${error.message}`);
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
   * Process and upload image
   * Generates thumbnail and uploads both to S3
   */
  private async processAndUploadImage(
    imageFile: Express.Multer.File
  ): Promise<{ imageUrl: string; imageThumbnailUrl: string }> {
    // Upload both original and thumbnail (thumbnail is generated automatically)
    const uploadResult = await this.storageService.uploadImageWithThumbnail(
      imageFile.buffer,
      imageFile.originalname
    );

    logger.warn('Image uploaded to S3', uploadResult, {
      originalUrl: uploadResult.original.url,
      thumbnailUrl: uploadResult.thumbnail.url,
    });

    return {
      imageUrl: uploadResult.original.url,
      imageThumbnailUrl: uploadResult.thumbnail.url,
    };
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
}
