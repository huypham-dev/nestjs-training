// Dependencies
import { EntityRepository } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';

// Common
import {
  AuthenticationException,
  AuthorizationException,
  ResourceNotFoundException,
} from '@/common/exceptions';

// Entities
import { Post } from './post.entity';

/**
 * Guard: Check if user is post owner only
 * - Only allows post owner to modify their own posts
 */
@Injectable()
export class PostOwnerGuard implements CanActivate {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: EntityRepository<Post>
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    if (!user) {
      throw new AuthenticationException();
    }

    const postId = request.params.id as string | undefined;

    if (!postId) {
      return true; // No post ID to check (e.g., create endpoint)
    }

    // Load post with user relation
    const post = await this.postRepository.findOne(
      { id: postId },
      { populate: ['user'] }
    );

    if (!post) {
      throw new ResourceNotFoundException(`Post with ID ${postId} not found`);
    }

    // Check if user is owner
    const isOwner = post.user.id === user.id;

    if (!isOwner) {
      throw new AuthorizationException();
    }

    return true;
  }
}

/**
 * Guard: Check if user is post owner or admin
 * - Allows post owner to modify/delete their own posts
 * - Allows admin to modify/delete any post
 */
@Injectable()
export class PostOwnerOrAdminGuard implements CanActivate {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: EntityRepository<Post>
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    if (!user) {
      throw new AuthenticationException();
    }

    const postId = request.params.id as string | undefined;

    if (!postId) {
      return true; // No post ID to check (e.g., create endpoint)
    }

    // Load post with user relation
    const post = await this.postRepository.findOne(
      { id: postId },
      { populate: ['user'] }
    );

    if (!post) {
      throw new ResourceNotFoundException(`Post with ID ${postId} not found`);
    }

    // Check if user is owner or admin
    const isOwner = post.user.id === user.id;
    const isAdmin = user.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new AuthorizationException();
    }

    return true;
  }
}
