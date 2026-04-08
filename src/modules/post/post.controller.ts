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
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiSecurity, ApiConsumes } from '@nestjs/swagger';

// Common
import { ApiDocumentation } from '@/common/decorators';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

// Modules
import { PostOwnerGuard } from '@/modules/post/post.guards';
import { CurrentUser } from '@/modules/user/user.decorators';
import { User } from '@/modules/user/user.entity';

// Services
import { PostService } from './post.service';

// Entities
import { Post as PostEntity } from './post.entity';

// DTOs
import {
  postQuerySchema,
  createPostSchema,
  updatePostSchema,
} from './post.dto';
import type { CreatePostDto, PostQueryDto, UpdatePostDto } from './post.dto';
import type { PostResponse } from './post.dto';

const IMAGE_FILE_PIPE = new ParseFilePipe({
  validators: [
    new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
    new FileTypeValidator({ fileType: '.(jpg|jpeg|png|webp)$' }),
  ],
  fileIsRequired: false,
});

@ApiTags('Posts')
@ApiSecurity('Auth')
@Controller()
export class PostController {
  constructor(private readonly postService: PostService) {}

  /**
   * Get all posts with visibility rules
   *
   * Retrieves a paginated list of posts with smart visibility:
   * - Users can see ALL their own posts (both DRAFT and PUBLISHED)
   * - Users can only see PUBLISHED posts from other authors
   * Supports pagination, search by title, and filtering by status.
   *
   * @param user - Current authenticated user from JWT token
   * @param query - Query parameters (offset, limit, search, status filter)
   * @returns Paginated list of posts with metadata
   *
   * @example
   * GET /posts?offset=0&limit=10&search=nestjs&status=PUBLISHED
   */
  @Get('posts')
  @HttpCode(HttpStatus.OK)
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
   * Create a new post
   *
   * Creates a new blog post with DRAFT status by default.
   * The post is automatically associated with the authenticated user as the author.
   * Optionally supports image upload (JPEG, PNG, WebP formats, max 5MB).
   * Image will be uploaded to cloud storage and thumbnails will be generated.
   *
   * @param user - Current authenticated user (becomes the post author)
   * @param payload - Post data (title, content, categoryIds)
   * @param image - Optional image file to upload (validated for size and type)
   * @returns Newly created post with generated IDs and timestamps
   *
   * @example
   * POST /posts
   * Content-Type: multipart/form-data
   * Body: { "title": "My Post", "content": "Content here", "categoryIds": ["uuid1", "uuid2"], "image": File }
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

    return {
      data: this.toPostResponse(post),
    };
  }

  /**
   * Get post by ID
   *
   * Retrieves a single post by its UUID with visibility rules:
   * - Anyone can view PUBLISHED posts
   * - Only the post owner can view DRAFT posts
   * Includes full post details with author info and categories.
   *
   * @param user - Current authenticated user (for ownership check)
   * @param postId - UUID of the post to retrieve
   * @returns Complete post data with author and categories
   * @throws NotFoundException if post doesn't exist
   * @throws ForbiddenException if user tries to view another user's DRAFT post
   *
   * @example
   * GET /posts/550e8400-e29b-41d4-a716-446655440000
   */
  @Get('posts/:id')
  @HttpCode(HttpStatus.OK)
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
   * Update post by ID
   *
   * Updates an existing post with new data.
   * Only the post owner can update their posts (enforced by PostOwnerGuard).
   * All fields are optional - only provided fields will be updated.
   * Supports updating the post image - uploading a new image replaces the existing one.
   * Old images are deleted from cloud storage when replaced.
   *
   * @param postId - UUID of the post to update
   * @param payload - Optional update data (title, content, categoryIds, status)
   * @param image - Optional new image file to replace existing image
   * @returns Updated post with new data and timestamps
   * @throws NotFoundException if post doesn't exist
   * @throws ForbiddenException if user is not the post owner
   *
   * @example
   * PATCH /posts/550e8400-e29b-41d4-a716-446655440000
   * Content-Type: multipart/form-data
   * Body: { "title": "Updated Title", "status": "PUBLISHED", "image": File }
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

    return {
      data: this.toPostResponse(post),
    };
  }

  /**
   * Delete post by ID
   *
   * Permanently deletes a post from the database.
   * Only the post owner can delete their posts (enforced by PostOwnerGuard).
   * Associated images in cloud storage are also deleted.
   * This action cannot be undone.
   *
   * @param postId - UUID of the post to delete
   * @returns No content (204 status)
   * @throws NotFoundException if post doesn't exist
   * @throws ForbiddenException if user is not the post owner
   *
   * @example
   * DELETE /posts/550e8400-e29b-41d4-a716-446655440000
   */
  @Delete('posts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(PostOwnerGuard)
  @ApiDocumentation({
    operation: {
      summary: 'Delete post by ID',
      description:
        'Permanently delete a post. Only the post owner can delete posts.',
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
  async deletePost(@Param('id', ParseUUIDPipe) postId: string) {
    await this.postService.deletePost(postId);
  }

  /**
   * Get posts by user ID
   *
   * Retrieves all posts created by a specific user with smart visibility:
   * - If requesting own posts: returns ALL posts (DRAFT + PUBLISHED)
   * - If requesting another user's posts: returns only PUBLISHED posts
   * Supports pagination, search by title, and filtering by status.
   * Useful for user profile pages showing their blog posts.
   *
   * @param currentUser - Current authenticated user making the request
   * @param userId - UUID of the user whose posts to retrieve
   * @param query - Query parameters (offset, limit, search, status filter)
   * @returns Paginated list of posts by the specified user
   * @throws NotFoundException if user doesn't exist
   *
   * @example
   * GET /users/550e8400-e29b-41d4-a716-446655440000/posts?offset=0&limit=10
   */
  @Get('users/:id/posts')
  @HttpCode(HttpStatus.OK)
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

  /**
   * Format paginated response
   *
   * Helper method to transform database posts into API response format.
   * Converts post entities to PostResponse DTOs and includes pagination metadata.
   *
   * @param result - Service result containing post data and optional metadata
   * @returns Formatted response with data array and meta object
   * @private
   */
  private formatPaginatedResponse(result: { data: PostEntity[]; meta?: any }) {
    return {
      data: result.data.map((post) => this.toPostResponse(post)),
      ...(result.meta && { meta: result.meta }),
    };
  }

  /**
   * Convert post entity to response DTO
   *
   * Helper method to transform a post entity into the API response format.
   * Extracts and formats all necessary fields including author info and categories.
   * Ensures consistent response structure across all post endpoints.
   *
   * @param post - Post entity from database (must include user and categories relations)
   * @returns Formatted post response DTO with all required fields
   * @private
   */
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
