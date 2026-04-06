// Dependencies
import { EntityManager } from '@mikro-orm/core';
import { getRepositoryToken } from '@mikro-orm/nestjs';
import { Test, TestingModule } from '@nestjs/testing';

// Common
import {
  AuthorizationException,
  ResourceNotFoundException,
} from '@/common/exceptions';

// Modules
import { Category } from '@/modules/category/category.entity';
import { User } from '@/modules/user/user.entity';

// Services
import { PostService } from './post.service';
import { StorageService } from '@/shared/services/storage/s3.service';

// Entities
import { Post } from './post.entity';

// Constants
import { PostStatus, UserRole } from '@/constants';

// Other
import { createCategoryFixture } from '@/test/fixtures/category.fixture';
import {
  createPostFixture,
  createPublishedPostFixture,
} from '@/test/fixtures/post.fixture';
import { createUserFixture } from '@/test/fixtures/user.fixture';
import {
  createMockRepository,
  createMockEntityManager,
} from '@/test/mocks/repository.mock';

describe('PostService', () => {
  let service: PostService;
  let postRepository: ReturnType<typeof createMockRepository>;
  let categoryRepository: ReturnType<typeof createMockRepository>;
  let userRepository: ReturnType<typeof createMockRepository>;
  let entityManager: ReturnType<typeof createMockEntityManager>;
  let storageService: jest.Mocked<StorageService>;

  beforeEach(async () => {
    // Create mock instances
    postRepository = createMockRepository();
    categoryRepository = createMockRepository();
    userRepository = createMockRepository();
    entityManager = createMockEntityManager();

    // Create mock services
    storageService = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
      getFileUrl: jest.fn(),
      processImage: jest.fn(),
      generateThumbnail: jest.fn(),
      uploadImage: jest.fn(),
      deleteFiles: jest.fn(),
      deleteImageByUrls: jest.fn(),
      validateImage: jest.fn(),
      getMetadata: jest.fn(),
      extractKeyFromUrl: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostService,
        {
          provide: getRepositoryToken(Post),
          useValue: postRepository,
        },
        {
          provide: getRepositoryToken(Category),
          useValue: categoryRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
        {
          provide: EntityManager,
          useValue: entityManager,
        },
        {
          provide: StorageService,
          useValue: storageService,
        },
      ],
    }).compile();

    service = module.get<PostService>(PostService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllPosts', () => {
    const currentUserId = 'user-123';

    it('should return all posts for current user', async () => {
      // Arrange
      const posts = [
        createPostFixture({ user: createUserFixture({ id: currentUserId }) }),
        createPublishedPostFixture(),
      ];
      postRepository.findAndCount.mockResolvedValue([posts, 2]);

      // Act
      const result = await service.getAllPosts(
        { offset: 0, limit: 10 },
        currentUserId,
        UserRole.ADMIN
      );

      // Assert
      expect(result.data).toEqual(posts);
      expect(result.meta?.pagination).toEqual({
        offset: 0,
        limit: 10,
        total: 2,
      });
      expect(postRepository.findAndCount).toHaveBeenCalled();
    });

    it('should filter by DRAFT status showing only user posts', async () => {
      // Arrange
      const userPost = createPostFixture({
        status: PostStatus.DRAFT,
        user: createUserFixture({ id: currentUserId }),
      });
      postRepository.findAndCount.mockResolvedValue([[userPost], 1]);

      // Act - regular user should only see their own drafts
      const result = await service.getAllPosts(
        { offset: 0, limit: 10, status: PostStatus.DRAFT },
        currentUserId,
        UserRole.USER
      );

      // Assert
      expect(result.data).toEqual([userPost]);
      expect(postRepository.findAndCount).toHaveBeenCalledWith(
        {
          status: PostStatus.DRAFT,
          user: currentUserId,
        },
        expect.any(Object)
      );
    });

    it('should filter by PUBLISHED status showing all published posts', async () => {
      // Arrange
      const posts = [
        createPublishedPostFixture(),
        createPublishedPostFixture(),
      ];
      postRepository.findAndCount.mockResolvedValue([posts, 2]);

      // Act
      await service.getAllPosts(
        { offset: 0, limit: 10, status: PostStatus.PUBLISHED },
        currentUserId,
        UserRole.ADMIN
      );

      // Assert
      expect(postRepository.findAndCount).toHaveBeenCalledWith(
        {
          status: PostStatus.PUBLISHED,
        },
        expect.any(Object)
      );
    });

    it('should search posts by title (case-insensitive)', async () => {
      // Arrange
      const searchQuery = 'nestjs';
      const posts = [
        createPublishedPostFixture({ title: 'Getting Started with NestJS' }),
        createPublishedPostFixture({ title: 'Advanced NestJS Patterns' }),
      ];
      postRepository.findAndCount.mockResolvedValue([posts, 2]);

      // Act
      await service.getAllPosts(
        { offset: 0, limit: 10, search: searchQuery },
        currentUserId,
        UserRole.USER
      );

      // Assert - when no status, search is included in $or conditions
      expect(postRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: [
            {
              status: PostStatus.PUBLISHED,
              title: { $ilike: `%${searchQuery}%` },
            },
            {
              status: PostStatus.DRAFT,
              user: currentUserId,
              title: { $ilike: `%${searchQuery}%` },
            },
          ],
        }),
        expect.any(Object)
      );
    });

    it('should combine search with status filter', async () => {
      // Arrange
      const searchQuery = 'typescript';
      const posts = [
        createPublishedPostFixture({ title: 'TypeScript Best Practices' }),
      ];
      postRepository.findAndCount.mockResolvedValue([posts, 1]);

      // Act
      await service.getAllPosts(
        {
          offset: 0,
          limit: 10,
          status: PostStatus.PUBLISHED,
          search: searchQuery,
        },
        currentUserId,
        UserRole.USER
      );

      // Assert
      expect(postRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PostStatus.PUBLISHED,
          title: { $ilike: `%${searchQuery}%` },
        }),
        expect.any(Object)
      );
    });
  });

  describe('getPostsByUserId', () => {
    const ownerId = 'owner-123';
    const viewerId = 'viewer-456';

    it('should return all posts when viewer is owner', async () => {
      // Arrange
      const posts = [
        createPostFixture({ status: PostStatus.DRAFT }),
        createPublishedPostFixture(),
      ];
      userRepository.count.mockResolvedValue(1); // User exists
      postRepository.findAndCount.mockResolvedValue([posts, 2]);

      // Act
      const result = await service.getPostsByUserId(
        ownerId,
        ownerId,
        UserRole.ADMIN,
        {
          offset: 0,
          limit: 10,
        }
      );

      // Assert
      expect(result.data).toEqual(posts);
      expect(postRepository.findAndCount).toHaveBeenCalledWith(
        { user: ownerId },
        expect.any(Object)
      );
    });

    it('should return only published posts when viewer is not owner', async () => {
      // Arrange
      const posts = [createPublishedPostFixture()];
      userRepository.count.mockResolvedValue(1); // User exists
      postRepository.findAndCount.mockResolvedValue([posts, 1]);

      // Act - regular user viewing someone else's posts
      const result = await service.getPostsByUserId(
        ownerId,
        viewerId,
        UserRole.USER,
        {
          offset: 0,
          limit: 10,
        }
      );

      // Assert
      expect(result.data).toEqual(posts);
      expect(postRepository.findAndCount).toHaveBeenCalledWith(
        {
          user: ownerId,
          status: PostStatus.PUBLISHED,
        },
        expect.any(Object)
      );
    });

    it('should search posts by title for specific user', async () => {
      // Arrange
      const searchQuery = 'tutorial';
      const posts = [
        createPublishedPostFixture({ title: 'NestJS Tutorial for Beginners' }),
      ];
      userRepository.count.mockResolvedValue(1); // User exists
      postRepository.findAndCount.mockResolvedValue([posts, 1]);

      // Act
      await service.getPostsByUserId(ownerId, viewerId, UserRole.USER, {
        offset: 0,
        limit: 10,
        search: searchQuery,
      });

      // Assert
      expect(postRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          user: ownerId,
          status: PostStatus.PUBLISHED,
          title: { $ilike: `%${searchQuery}%` },
        }),
        expect.any(Object)
      );
    });
  });

  describe('createPost', () => {
    it('should create a draft post with categories', async () => {
      // Arrange
      const userId = 'user-123';
      const categoryIds = ['cat-1', 'cat-2'];
      const categories = [
        createCategoryFixture({ id: 'cat-1' }),
        createCategoryFixture({ id: 'cat-2' }),
      ];
      const newPost = createPostFixture({
        categories: {
          add: jest.fn(),
        } as any,
      });

      categoryRepository.find.mockResolvedValue(categories);
      postRepository.create.mockReturnValue(newPost);
      entityManager.populate.mockResolvedValue(newPost);

      // Act
      const result = await service.createPost(userId, {
        title: 'Test Post',
        content: 'Test Content',
        categoryIds,
      });

      // Assert
      expect(result).toEqual(newPost);
      expect(categoryRepository.find).toHaveBeenCalledWith({
        id: { $in: categoryIds },
      });
      expect(postRepository.create).toHaveBeenCalledWith({
        title: 'Test Post',
        content: 'Test Content',
        user: userId,
      });
      expect(newPost.categories.add).toHaveBeenCalledTimes(2);
      expect(entityManager.persist).toHaveBeenCalledWith(newPost);
      expect(entityManager.populate).toHaveBeenCalledWith(newPost, [
        'user',
        'categories',
      ]);
    });

    it('should throw ResourceNotFoundException when category not found', async () => {
      // Arrange
      const userId = 'user-123';
      const categoryIds = ['cat-1', 'cat-2', 'cat-3'];
      const categories = [createCategoryFixture({ id: 'cat-1' })]; // Only 1 found

      categoryRepository.find.mockResolvedValue(categories);

      // Act & Assert
      await expect(
        service.createPost(userId, {
          title: 'Test',
          content: 'Test',
          categoryIds,
        })
      ).rejects.toThrow(ResourceNotFoundException);
      await expect(
        service.createPost(userId, {
          title: 'Test',
          content: 'Test',
          categoryIds,
        })
      ).rejects.toThrow('Categories not found');
    });
  });

  describe('getPostById', () => {
    const currentUserId = 'user-123';

    it('should return published post for any user', async () => {
      // Arrange
      const post = createPublishedPostFixture({
        user: createUserFixture({ id: 'other-user' }),
      });
      postRepository.findOne.mockResolvedValue(post);

      // Act
      const result = await service.getPostById('post-123', currentUserId);

      // Assert
      expect(result).toEqual(post);
      expect(postRepository.findOne).toHaveBeenCalledWith(
        { id: 'post-123' },
        { populate: ['user', 'categories'] }
      );
    });

    it('should return draft post for owner', async () => {
      // Arrange
      const post = createPostFixture({
        status: PostStatus.DRAFT,
        user: createUserFixture({ id: currentUserId }),
      });
      postRepository.findOne.mockResolvedValue(post);

      // Act
      const result = await service.getPostById('post-123', currentUserId);

      // Assert
      expect(result).toEqual(post);
    });

    it('should throw AuthorizationException for draft post by non-owner', async () => {
      // Arrange
      const post = createPostFixture({
        status: PostStatus.DRAFT,
        user: createUserFixture({ id: 'other-user' }),
      });
      postRepository.findOne.mockResolvedValue(post);

      // Act & Assert - non-owner should not see other user's draft
      await expect(
        service.getPostById('post-123', currentUserId)
      ).rejects.toThrow(AuthorizationException);
    });

    it('should throw ResourceNotFoundException when post not found', async () => {
      // Arrange
      postRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getPostById('non-existent', currentUserId)
      ).rejects.toThrow(ResourceNotFoundException);
    });
  });

  describe('updatePost', () => {
    it('should update post title and content', async () => {
      // Arrange
      const post = createPostFixture();
      postRepository.findOne.mockResolvedValue(post);
      entityManager.flush.mockResolvedValue(undefined);

      // Act
      const result = await service.updatePost('post-123', {
        title: 'Updated Title',
        content: 'Updated Content',
      });

      // Assert
      expect(result.title).toBe('Updated Title');
      expect(result.content).toBe('Updated Content');
      expect(entityManager.flush).toHaveBeenCalled();
    });

    it('should update categories when provided', async () => {
      // Arrange
      const post = createPostFixture();
      const newCategories = [
        createCategoryFixture({ id: 'new-cat-1' }),
        createCategoryFixture({ id: 'new-cat-2' }),
      ];
      postRepository.findOne.mockResolvedValue(post);
      categoryRepository.find.mockResolvedValue(newCategories);
      entityManager.flush.mockResolvedValue(undefined);

      // Mock collection methods
      post.categories.removeAll = jest.fn();
      post.categories.add = jest.fn();

      // Act
      await service.updatePost('post-123', {
        categoryIds: ['new-cat-1', 'new-cat-2'],
      });

      // Assert
      expect(post.categories.removeAll).toHaveBeenCalled();
      expect(post.categories.add).toHaveBeenCalledTimes(2);
      expect(categoryRepository.find).toHaveBeenCalledWith({
        id: { $in: ['new-cat-1', 'new-cat-2'] },
      });
    });

    it('should throw ResourceNotFoundException when post not found', async () => {
      // Arrange
      postRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.updatePost('non-existent', {
          title: 'Test',
        })
      ).rejects.toThrow(ResourceNotFoundException);
    });

    it('should throw ResourceNotFoundException when category not found', async () => {
      // Arrange
      const post = createPostFixture();
      postRepository.findOne.mockResolvedValue(post);
      categoryRepository.find.mockResolvedValue([]); // No categories found

      // Act & Assert
      await expect(
        service.updatePost('post-123', {
          categoryIds: ['cat-1', 'cat-2'],
        })
      ).rejects.toThrow(ResourceNotFoundException);
    });
  });

  describe('deletePost', () => {
    it('should delete post successfully', async () => {
      // Arrange
      const post = createPostFixture();
      postRepository.findOne.mockResolvedValue(post);
      entityManager.flush.mockResolvedValue(undefined);
      entityManager.remove.mockReturnValue(undefined);

      // Mock collection methods
      post.categories.removeAll = jest.fn();

      // Act
      await service.deletePost('post-123');

      // Assert
      expect(post.categories.removeAll).toHaveBeenCalled();
      expect(entityManager.flush).toHaveBeenCalled();
      expect(entityManager.remove).toHaveBeenCalledWith(post);
    });

    it('should throw ResourceNotFoundException when post not found', async () => {
      // Arrange
      postRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.deletePost('non-existent')).rejects.toThrow(
        ResourceNotFoundException
      );
    });
  });
});
