// Dependencies
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  Patch,
  UseGuards,
  ParseUUIDPipe,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiSecurity } from '@nestjs/swagger';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';

// Common decorators
import { ApiDocumentation } from '@/common/decorators';

// Services
import { PostService } from './post.service';
import { CacheService } from '@/common/services';

// Constants
import { CACHE_KEYS } from '@/constants';

// DTOs
import {
  postQuerySchema,
  createPostSchema,
  updatePostSchema,
} from './post.dto';
import type { PostQueryDto, CreatePostDto, UpdatePostDto } from './post.dto';

// Pipes
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

// Decorators
import { CurrentUser } from '@/modules/user/user.decorators';

// Guards
import { PostOwnerOrAdminGuard } from '@/modules/post/post.guards';

// Entities
import { Post as PostEntity } from './post.entity';
import { User } from '@/modules/user/user.entity';

// Types
import type { PostResponse } from './post.dto';

@ApiTags('Posts')
@ApiSecurity('clerk-auth')
@Controller()
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly cacheService: CacheService
  ) {}

  /**
   * GET /posts
   * Get posts with visibility rules applied
   * - User can see their own posts (DRAFT + PUBLISHED)
   * - Can only see PUBLISHED posts from others
   */
  @Get('posts')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(CacheInterceptor)
  @CacheKey(CACHE_KEYS.POSTS_LIST)
  @CacheTTL(60000) // 60 seconds
  @ApiDocumentation({
    operation: {
      summary: 'Get all posts',
      description:
        'Retrieve a paginated list of posts. Users can see their own posts (DRAFT + PUBLISHED) and PUBLISHED posts from others. Admins can see all posts.',
    },
    response: {
      status: 200,
      description: 'Successfully retrieved posts list',
      schema: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/PostResponse' },
          },
          meta: {
            type: 'object',
            properties: {
              pagination: {
                type: 'object',
                properties: {
                  offset: { type: 'number' },
                  limit: { type: 'number' },
                  total: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
  })
  async getAllPosts(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(postQuerySchema)) query: PostQueryDto
  ) {
    const result = await this.postService.getAllPosts(
      query,
      user.id,
      user.role
    );

    return {
      data: result.data.map((post) => this.toPostResponse(post)),
      ...(result.meta ? { meta: result.meta } : {}),
    };
  }

  /**
   * POST /posts
   * Create a new post (as DRAFT by default)
   * Requires authentication
   */
  @Post('posts')
  @HttpCode(HttpStatus.CREATED)
  @ApiDocumentation({
    operation: {
      summary: 'Create a new post',
      description:
        'Create a new blog post with the status DRAFT by default. The post will be associated with the authenticated user as the author.',
    },
    body: {
      schema: { $ref: '#/components/schemas/CreatePostRequest' },
      description: 'Post creation data',
    },
    response: {
      status: 201,
      description: 'Post created successfully',
      schema: {
        type: 'object',
        properties: {
          data: { $ref: '#/components/schemas/PostResponse' },
        },
      },
    },
  })
  async createPost(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createPostSchema)) payload: CreatePostDto
  ) {
    const post = await this.postService.createPost(user.id, {
      title: payload.title,
      content: payload.content,
      categoryIds: payload.categoryIds,
    });

    // Invalidate post caches
    await this.cacheService.invalidatePostCaches(undefined, user.id);

    return {
      data: this.toPostResponse(post),
    };
  }

  /**
   * GET /posts/:id
   * Get a single post by ID
   * - Anyone can view PUBLISHED posts
   * - Only owner and admin can view DRAFT posts
   */
  @Get('posts/:id')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60000) // 60 seconds
  @ApiDocumentation({
    operation: {
      summary: 'Get post by ID',
      description:
        'Retrieve a single post by its UUID. Anyone can view PUBLISHED posts, but only the owner or admin can view DRAFT posts.',
    },
    params: [
      {
        name: 'id',
        type: 'string',
        format: 'uuid',
        description: 'Post UUID',
        example: '550e8400-e29b-41d4-a716-446655440000',
      },
    ],
    response: {
      status: 200,
      description: 'Successfully retrieved post',
      schema: {
        type: 'object',
        properties: {
          data: { $ref: '#/components/schemas/PostResponse' },
        },
      },
    },
  })
  async getPostById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) postId: string
  ) {
    const post = await this.postService.getPostById(postId, user.id, user.role);

    return {
      data: this.toPostResponse(post),
    };
  }

  /**
   * PATCH /posts/:id
   * Update a post by ID
   * - Only owner or admin can update (checked by guard)
   */
  @Patch('posts/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PostOwnerOrAdminGuard)
  @ApiDocumentation({
    operation: {
      summary: 'Update post by ID',
      description:
        'Update an existing post. Only the post owner or administrators can update posts. All fields are optional.',
    },
    params: [
      {
        name: 'id',
        type: 'string',
        format: 'uuid',
        description: 'Post UUID',
        example: '550e8400-e29b-41d4-a716-446655440000',
      },
    ],
    body: {
      schema: { $ref: '#/components/schemas/UpdatePostRequest' },
      description: 'Post update data (all fields optional)',
    },
    response: {
      status: 200,
      description: 'Post updated successfully',
      schema: {
        type: 'object',
        properties: {
          data: { $ref: '#/components/schemas/PostResponse' },
        },
      },
    },
  })
  async updatePost(
    @Param('id', ParseUUIDPipe) postId: string,
    @Body(new ZodValidationPipe(updatePostSchema)) payload: UpdatePostDto
  ) {
    const post = await this.postService.updatePost(postId, {
      title: payload.title,
      content: payload.content,
      categoryIds: payload.categoryIds,
      status: payload.status,
    });

    // Invalidate post caches
    await this.cacheService.invalidatePostCaches(postId, post.user.id);

    return {
      data: this.toPostResponse(post),
    };
  }

  /**
   * DELETE /posts/:id
   * Delete a post by ID
   * - Only owner or admin can delete (checked by guard)
   */
  @Delete('posts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(PostOwnerOrAdminGuard)
  @ApiDocumentation({
    operation: {
      summary: 'Delete post by ID',
      description:
        'Permanently delete a post. Only the post owner or administrators can delete posts.',
    },
    params: [
      {
        name: 'id',
        type: 'string',
        format: 'uuid',
        description: 'Post UUID',
        example: '550e8400-e29b-41d4-a716-446655440000',
      },
    ],
    response: { status: 204, description: 'Post deleted successfully' },
  })
  async deletePost(
    @Param('id', ParseUUIDPipe) postId: string,
    @CurrentUser() user: User
  ) {
    // Get post to know user id before deletion
    const post = await this.postService.getPostById(postId, user.id, user.role);
    await this.postService.deletePost(postId);

    // Invalidate post caches
    await this.cacheService.invalidatePostCaches(postId, post.user.id);
  }

  /**
   * GET /users/:id/posts
   * Get all posts by a specific user
   * - Owner can see all their posts (DRAFT + PUBLISHED)
   * - Others can only see PUBLISHED posts
   */
  @Get('users/:id/posts')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60000) // 60 seconds
  @ApiDocumentation({
    operation: {
      summary: 'Get posts by user ID',
      description:
        'Retrieve all posts created by a specific user. The post owner and admins can see all posts (DRAFT + PUBLISHED), while others can only see PUBLISHED posts.',
    },
    params: [
      {
        name: 'id',
        type: 'string',
        format: 'uuid',
        description: 'User UUID',
        example: '550e8400-e29b-41d4-a716-446655440000',
      },
    ],
    response: {
      status: 200,
      description: 'Successfully retrieved user posts',
      schema: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/PostResponse' },
          },
          meta: {
            type: 'object',
            properties: {
              pagination: {
                type: 'object',
                properties: {
                  offset: { type: 'number' },
                  limit: { type: 'number' },
                  total: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
  })
  async getPostsByUser(
    @CurrentUser() currentUser: User,
    @Param('id', ParseUUIDPipe) userId: string,
    @Query(new ZodValidationPipe(postQuerySchema))
    query: PostQueryDto
  ) {
    const result = await this.postService.getPostsByUserId(
      userId,
      currentUser.id,
      currentUser.role,
      {
        offset: query.offset ?? 0,
        limit: query.limit ?? 10,
      }
    );

    return {
      data: result.data.map((post) => this.toPostResponse(post)),
      ...(result.meta ? { meta: result.meta } : {}),
    };
  }

  private toPostResponse(post: PostEntity): PostResponse {
    return {
      id: post.id,
      title: post.title,
      content: post.content,
      status: post.status,
      author: {
        id: post.user.id,
        email: post.user.email,
        fullName: post.user.fullName,
      },
      categories: post.categories.map((category) => ({
        id: category.id,
        name: category.name,
      })),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  }
}
