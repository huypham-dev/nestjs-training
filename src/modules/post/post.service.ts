// Dependencies
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository, FilterQuery } from '@mikro-orm/core';

// Entities
import { Post } from './post.entity';
import { Category } from '@/modules/category/category.entity';
import { User } from '@/modules/user/user.entity';

// Constants
import { PostStatus } from '@/constants';

// Exceptions
import {
  AuthorizationException,
  ResourceNotFoundException,
} from '@/common/exceptions';

// Interfaces
import { SuccessResponse } from '@/common/interfaces';
import { PostQueryDto, UpdatePostDto } from './post.dto';

@Injectable()
export class PostService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: EntityRepository<Post>,
    @InjectRepository(Category)
    private readonly categoryRepository: EntityRepository<Category>,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    private readonly em: EntityManager
  ) {}

  /**
   * Get posts with visibility rules:
   * - Returns only PUBLISHED posts by default (for regular users)
   * - Admin can see ALL posts (published + draft)
   * - Use status query param to filter (e.g., status=draft shows current user's drafts)
   */
  async getAllPosts(
    options: PostQueryDto,
    currentUserId: string,
    currentUserRole: string
  ): Promise<SuccessResponse<Post[]>> {
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 10;

    // Build query based on filtering rules
    const where = this.buildPostQuery(
      options.status,
      currentUserId,
      currentUserRole
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
   * - Admin can see all posts
   * - Others can only see PUBLISHED posts
   */
  async getPostsByUserId(
    targetUserId: string,
    currentUserId: string,
    currentUserRole: string,
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

    // Build where condition based on ownership and role
    const where: FilterQuery<Post> = { user: targetUserId };

    // If not owner and not admin, only show published posts
    const isOwner = targetUserId === currentUserId;
    const isAdmin = currentUserRole === 'admin';

    if (!isOwner && !isAdmin) {
      where.status = PostStatus.PUBLISHED;
    }

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
   * Build query filter based on status and current user
   */
  private buildPostQuery(
    status: PostStatus | undefined,
    currentUserId: string,
    currentUserRole: string
  ): FilterQuery<Post> {
    const isAdmin = currentUserRole === 'admin';

    // Case 1: No status provided
    // - Admin sees ALL posts
    // - Regular users see only PUBLISHED posts
    if (!status) {
      if (isAdmin) {
        return {}; // No filter - return all posts
      }
      return {
        status: PostStatus.PUBLISHED,
      };
    }

    // Case 2: status = PUBLISHED
    // Return all PUBLISHED posts
    if (status === PostStatus.PUBLISHED) {
      return {
        status: PostStatus.PUBLISHED,
      };
    }

    // Case 3: status = DRAFT
    // Admin sees all drafts, regular users see only their own drafts
    if (status === PostStatus.DRAFT) {
      if (isAdmin) {
        return { status: PostStatus.DRAFT };
      }
      return {
        status: PostStatus.DRAFT,
        user: currentUserId,
      };
    }

    // Fallback (should not reach here)
    return {};
  }

  /**
   * Create a new post
   * Post is created as DRAFT by default
   */
  async createPost(
    userId: string,
    data: { title: string; content: string; categoryIds: string[] }
  ): Promise<Post> {
    // Validate categories exist
    const categories = await this.categoryRepository.find({
      id: { $in: data.categoryIds },
    });

    if (categories.length !== data.categoryIds.length) {
      const foundIds = categories.map((c) => c.id);
      const missingIds = data.categoryIds.filter(
        (id) => !foundIds.includes(id)
      );
      throw new ResourceNotFoundException(
        `Categories not found: ${missingIds.join(', ')}`
      );
    }

    // Create post
    const post = this.postRepository.create({
      title: data.title,
      content: data.content,
      user: userId,
    });

    // Add categories (if any)
    if (categories.length > 0) {
      categories.forEach((category) => {
        post.categories.add(category);
      });
    }

    // Persist to database
    await this.em.persistAndFlush(post);

    // Load relations for response
    await this.em.populate(post, ['user', 'categories']);

    return post;
  }

  /**
   * Get a single post by ID
   * - Anyone can view PUBLISHED posts
   * - Only owner and admin can view DRAFT posts
   */
  async getPostById(
    postId: string,
    currentUserId: string,
    currentUserRole: string
  ): Promise<Post> {
    const post = await this.postRepository.findOne(
      { id: postId },
      { populate: ['user', 'categories'] }
    );

    if (!post) {
      throw new ResourceNotFoundException(`Post with ID '${postId}' not found`);
    }

    // Check visibility rules
    // If post is DRAFT, only owner and admin can view
    const isOwner = post.user.id === currentUserId;
    const isAdmin = currentUserRole === 'admin';

    if (
      (post.status as PostStatus) === PostStatus.DRAFT &&
      !isOwner &&
      !isAdmin
    ) {
      throw new AuthorizationException(
        'You do not have permission to view this post'
      );
    }

    return post;
  }
  /**
   *  Update a post by ID
   *  - Authorization checked by PostOwnerOrAdminGuard
   */
  async updatePost(postId: string, data: UpdatePostDto): Promise<Post> {
    const post = await this.postRepository.findOne(
      { id: postId },
      { populate: ['user', 'categories'] }
    );

    if (!post) {
      throw new ResourceNotFoundException(`Post with ID '${postId}' not found`);
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
      const categories = await this.categoryRepository.find({
        id: { $in: data.categoryIds },
      });

      if (categories.length !== data.categoryIds.length) {
        const foundIds = categories.map((c) => c.id);
        const missingIds = data.categoryIds.filter(
          (id) => !foundIds.includes(id)
        );
        throw new ResourceNotFoundException(
          `Categories not found: ${missingIds.join(', ')}`
        );
      }

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

    // Remove all categories from the post to avoid FK constraint error
    post.categories.removeAll();
    await this.em.flush();

    // Delete the post
    this.em.remove(post);
    await this.em.flush();
  }
}
