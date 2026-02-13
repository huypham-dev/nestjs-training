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
} from '@nestjs/common';

// Services
import { PostService } from './post.service';

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

@Controller()
export class PostController {
  constructor(private readonly postService: PostService) {}

  /**
   * GET /posts
   * Get posts with visibility rules applied
   * - User can see their own posts (DRAFT + PUBLISHED)
   * - Can only see PUBLISHED posts from others
   */
  @Get('posts')
  @HttpCode(HttpStatus.OK)
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
  async createPost(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createPostSchema)) payload: CreatePostDto
  ) {
    const post = await this.postService.createPost(user.id, {
      title: payload.title,
      content: payload.content,
      categoryIds: payload.categoryIds,
    });

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
  async deletePost(@Param('id', ParseUUIDPipe) postId: string) {
    await this.postService.deletePost(postId);
  }

  /**
   * GET /users/:id/posts
   * Get all posts by a specific user
   * - Owner can see all their posts (DRAFT + PUBLISHED)
   * - Others can only see PUBLISHED posts
   */
  @Get('users/:id/posts')
  @HttpCode(HttpStatus.OK)
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
