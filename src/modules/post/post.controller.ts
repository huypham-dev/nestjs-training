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
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { ApiTags, ApiSecurity, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

// Common decorators
import { ApiDocumentation } from '@/common/decorators';

// Services
import { PostService } from './post.service';
import { CacheService } from '@/common/services';

// DTOs
import {
  postQuerySchema,
  createPostSchema,
  updatePostSchema,
} from './post.dto';
import type { CreatePostDto, PostQueryDto, UpdatePostDto } from './post.dto';

// Pipes
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

// Decorators
import { CurrentUser } from '@/modules/user/user.decorators';

// Guards
import {
  PostOwnerGuard,
  PostOwnerOrAdminGuard,
} from '@/modules/post/post.guards';

// Entities
import { Post as PostEntity } from './post.entity';
import { User } from '@/modules/user/user.entity';

// Types
import type { PostResponse } from './post.dto';

const IMAGE_FILE_PIPE = new ParseFilePipe({
  validators: [
    new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
    new FileTypeValidator({ fileType: '.(jpg|jpeg|png|webp)$' }),
  ],
  fileIsRequired: false,
});

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
  // @UseInterceptors(CacheInterceptor)
  // @CacheKey(CACHE_KEYS.POSTS_LIST)
  // @CacheTTL(60000) // 60 seconds
  @ApiDocumentation({
    operation: {
      summary: 'Get all posts',
      description:
        'Retrieve a paginated list of posts. Users can see their own posts (DRAFT + PUBLISHED) and PUBLISHED posts from others. Supports searching by title and filtering by status.',
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

    return this.formatPaginatedResponse(result);
  }

  /**
   * POST /posts
   * Create a new post (as DRAFT by default)
   * Requires authentication
   * Supports image upload
   */
  @Post('posts')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiDocumentation({
    operation: {
      summary: 'Create a new post',
      description:
        'Create a new blog post with the status DRAFT by default. The post will be associated with the authenticated user as the author. Optionally upload an image (JPEG, PNG, or WebP, max 5MB).',
    },
    body: {
      schema: { $ref: '#/components/schemas/CreatePostRequest' },
      description: 'Post creation data with optional image upload',
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
    @Body(new ZodValidationPipe(createPostSchema)) payload: CreatePostDto,
    @UploadedFile(IMAGE_FILE_PIPE) image?: Express.Multer.File
  ) {
    const post = await this.postService.createPost(
      user.id,
      {
        title: payload.title,
        content: payload.content,
        categoryIds: payload.categoryIds,
      },
      image
    );

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
   * - Only owner can view DRAFT posts
   */
  @Get('posts/:id')
  @HttpCode(HttpStatus.OK)
  // @UseInterceptors(CacheInterceptor)
  // @CacheTTL(60000) // 60 seconds
  @ApiDocumentation({
    operation: {
      summary: 'Get post by ID',
      description:
        'Retrieve a single post by its UUID. Anyone can view PUBLISHED posts, but only the owner can view DRAFT posts.',
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
    const post = await this.postService.getPostById(postId, user.id);

    return {
      data: this.toPostResponse(post),
    };
  }

  /**
   * PATCH /posts/:id
   * Update a post by ID
   * - Only owner or admin can update (checked by guard)
   * - Supports image upload/update
   */
  @Patch('posts/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PostOwnerGuard)
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiDocumentation({
    operation: {
      summary: 'Update post by ID',
      description:
        'Update an existing post. Only the post owner can update posts. All fields are optional. Uploading a new image will replace the existing one.',
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
    @Body(new ZodValidationPipe(updatePostSchema)) payload: UpdatePostDto,
    @UploadedFile(IMAGE_FILE_PIPE) image?: Express.Multer.File
  ) {
    const post = await this.postService.updatePost(
      postId,
      {
        title: payload.title,
        content: payload.content,
        categoryIds: payload.categoryIds,
        status: payload.status,
      },
      image
    );

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
    const post = await this.postService.getPostById(postId, user.id);
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
  // @HttpCode(HttpStatus.OK)
  // @UseInterceptors(CacheInterceptor)
  // @CacheTTL(60000) // 60 seconds
  @ApiDocumentation({
    operation: {
      summary: 'Get posts by user ID',
      description:
        'Retrieve all posts created by a specific user. The post owner can see all posts (DRAFT + PUBLISHED), while others can only see PUBLISHED posts. Supports searching by title and filtering by status.',
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
        status: query.status,
        search: query.search,
      }
    );

    return this.formatPaginatedResponse(result);
  }

  private parseCategoryIds(categoryIds: any): string[] | undefined {
    if (!categoryIds) return undefined;
    if (Array.isArray(categoryIds)) return categoryIds;
    try {
      return JSON.parse(categoryIds as string);
    } catch {
      return undefined;
    }
  }

  private formatPaginatedResponse(result: { data: PostEntity[]; meta?: any }) {
    return {
      data: result.data.map((post) => this.toPostResponse(post)),
      ...(result.meta && { meta: result.meta }),
    };
  }

  private toPostResponse(post: PostEntity): PostResponse {
    return {
      id: post.id,
      title: post.title,
      content: post.content,
      status: post.status,
      imageUrl: post.imageUrl,
      imageThumbnailUrl: post.imageThumbnailUrl,
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
