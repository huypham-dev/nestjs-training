import { Test, TestingModule } from '@nestjs/testing';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { PostOwnerOrAdminGuard } from './post.guards';
import { PostStatus } from '@/constants';
import {
  createPostFixture,
  createPublishedPostFixture,
} from '@/test/fixtures/post.fixture';
import { createUserFixture } from '@/test/fixtures/user.fixture';
import { createCategoryFixture } from '@/test/fixtures/category.fixture';

describe('PostController', () => {
  let controller: PostController;
  let postService: jest.Mocked<PostService>;
  let currentUser: any;

  beforeEach(async () => {
    // Create mock service
    const mockPostService = {
      getAllPosts: jest.fn(),
      createPost: jest.fn(),
      getPostById: jest.fn(),
      updatePost: jest.fn(),
      deletePost: jest.fn(),
      getPostsByUserId: jest.fn(),
    };

    // Mock guard
    const mockGuard = {
      canActivate: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostController],
      providers: [
        {
          provide: PostService,
          useValue: mockPostService,
        },
      ],
    })
      .overrideGuard(PostOwnerOrAdminGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<PostController>(PostController);
    postService = module.get(PostService);

    // Setup current user
    currentUser = createUserFixture({ id: 'current-user-id' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllPosts', () => {
    it('should return paginated posts', async () => {
      // Arrange
      const posts = [
        createPublishedPostFixture(),
        createPublishedPostFixture(),
      ];
      const query = { offset: 0, limit: 10 };
      const serviceResult = {
        data: posts,
        meta: {
          pagination: {
            total: 2,
            offset: 0,
            limit: 10,
          },
        },
      };

      postService.getAllPosts.mockResolvedValue(serviceResult);

      // Act
      const result = await controller.getAllPosts(currentUser, query);

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.meta).toBeDefined();
      expect(postService.getAllPosts).toHaveBeenCalledWith(
        query,
        currentUser.id,
        currentUser.role
      );
    });

    it('should return empty array when no posts found', async () => {
      // Arrange
      const query = { offset: 0, limit: 10 };
      const serviceResult = {
        data: [],
        meta: {
          pagination: {
            total: 0,
            offset: 0,
            limit: 10,
          },
        },
      };

      postService.getAllPosts.mockResolvedValue(serviceResult);

      // Act
      const result = await controller.getAllPosts(currentUser, query);

      // Assert
      expect(result.data).toEqual([]);
    });

    it('should transform posts to response format', async () => {
      // Arrange
      const post = createPublishedPostFixture({
        id: 'post-123',
        title: 'Test Post',
      });
      const query = { offset: 0, limit: 10 };
      const serviceResult = {
        data: [post],
        meta: {
          pagination: { total: 1, offset: 0, limit: 10 },
        },
      };

      postService.getAllPosts.mockResolvedValue(serviceResult);

      // Act
      const result = await controller.getAllPosts(currentUser, query);

      // Assert
      expect(result.data[0]).toMatchObject({
        id: 'post-123',
        title: 'Test Post',
        status: PostStatus.PUBLISHED,
      });
    });
  });

  describe('createPost', () => {
    it('should create a new post', async () => {
      // Arrange
      const payload = {
        title: 'New Post',
        content: 'Post content',
        categoryIds: ['cat-1', 'cat-2'],
      };
      const categories = [
        createCategoryFixture({ id: 'cat-1' }),
        createCategoryFixture({ id: 'cat-2' }),
      ];
      const createdPost = createPostFixture({
        title: payload.title,
        content: payload.content,
        user: currentUser,
      });
      // Mock categories collection properly
      createdPost.categories = categories as any;

      postService.createPost.mockResolvedValue(createdPost);

      // Act
      const result = await controller.createPost(currentUser, payload);

      // Assert
      expect(result.data).toMatchObject({
        title: 'New Post',
        content: 'Post content',
        status: PostStatus.DRAFT,
      });
      expect(result.data.categories).toHaveLength(2);
      expect(postService.createPost).toHaveBeenCalledWith(currentUser.id, {
        title: payload.title,
        content: payload.content,
        categoryIds: payload.categoryIds,
      });
    });

    it('should create post without categories', async () => {
      // Arrange
      const payload = {
        title: 'Simple Post',
        content: 'Simple content',
        categoryIds: [],
      };
      const createdPost = createPostFixture({
        ...payload,
        user: currentUser,
      });
      createdPost.categories = [] as any;

      postService.createPost.mockResolvedValue(createdPost);

      // Act
      const result = await controller.createPost(currentUser, payload);

      // Assert
      expect(result.data.title).toBe('Simple Post');
      expect(result.data.categories).toHaveLength(0);
    });
  });

  describe('getPostById', () => {
    it('should return a published post', async () => {
      // Arrange
      const post = createPublishedPostFixture({ id: 'post-123' });
      postService.getPostById.mockResolvedValue(post);

      // Act
      const result = await controller.getPostById(currentUser, 'post-123');

      // Assert
      expect(result.data.id).toBe('post-123');
      expect(result.data.status).toBe(PostStatus.PUBLISHED);
      expect(postService.getPostById).toHaveBeenCalledWith(
        'post-123',
        currentUser.id,
        currentUser.role
      );
    });

    it('should return draft post for owner', async () => {
      // Arrange
      const post = createPostFixture({
        id: 'post-456',
        user: currentUser,
        status: PostStatus.DRAFT,
      });
      postService.getPostById.mockResolvedValue(post);

      // Act
      const result = await controller.getPostById(currentUser, 'post-456');

      // Assert
      expect(result.data.status).toBe(PostStatus.DRAFT);
    });
  });

  describe('updatePost', () => {
    it('should update post successfully', async () => {
      // Arrange
      const postId = 'post-123';
      const payload = {
        title: 'Updated Title',
        content: 'Updated content',
        categoryIds: ['cat-1'],
      };
      const updatedPost = createPostFixture({
        id: postId,
        ...payload,
      });
      updatedPost.categories = [createCategoryFixture({ id: 'cat-1' })] as any;

      postService.updatePost.mockResolvedValue(updatedPost);

      // Act
      const result = await controller.updatePost(postId, payload);

      // Assert
      expect(result.data.title).toBe('Updated Title');
      expect(result.data.categories).toHaveLength(1);
      expect(postService.updatePost).toHaveBeenCalledWith(postId, {
        title: payload.title,
        content: payload.content,
        categoryIds: payload.categoryIds,
      });
    });

    it('should update only provided fields', async () => {
      // Arrange
      const postId = 'post-123';
      const payload = {
        title: 'Only Title Updated',
      };
      const updatedPost = createPostFixture({
        id: postId,
        title: payload.title,
      });

      postService.updatePost.mockResolvedValue(updatedPost);

      // Act
      const result = await controller.updatePost(postId, payload);

      // Assert
      expect(result.data.title).toBe('Only Title Updated');
    });
  });

  describe('deletePost', () => {
    it('should delete post successfully', async () => {
      // Arrange
      const postId = 'post-123';
      postService.deletePost.mockResolvedValue(undefined);

      // Act
      await controller.deletePost(postId);

      // Assert
      expect(postService.deletePost).toHaveBeenCalledWith(postId);
    });
  });

  describe('getPostsByUser', () => {
    it('should return posts by user with pagination', async () => {
      // Arrange
      const userId = 'user-123';
      const query = { offset: 0, limit: 10 };
      const posts = [
        createPublishedPostFixture(),
        createPublishedPostFixture(),
      ];
      const serviceResult = {
        data: posts,
        meta: {
          pagination: {
            total: 2,
            offset: 0,
            limit: 10,
          },
        },
      };

      postService.getPostsByUserId.mockResolvedValue(serviceResult);

      // Act
      const result = await controller.getPostsByUser(
        currentUser,
        userId,
        query
      );

      // Assert
      expect(result.data).toHaveLength(2);
      expect(postService.getPostsByUserId).toHaveBeenCalledWith(
        userId,
        currentUser.id,
        currentUser.role,
        {
          offset: 0,
          limit: 10,
        }
      );
    });

    it('should return empty array when user has no posts', async () => {
      // Arrange
      const userId = 'user-456';
      const query = { offset: 0, limit: 10 };
      const serviceResult = {
        data: [],
        meta: {
          pagination: { total: 0, offset: 0, limit: 10 },
        },
      };

      postService.getPostsByUserId.mockResolvedValue(serviceResult);

      // Act
      const result = await controller.getPostsByUser(
        currentUser,
        userId,
        query
      );

      // Assert
      expect(result.data).toEqual([]);
    });

    it('should use default pagination when not provided', async () => {
      // Arrange
      const userId = 'user-789';
      const query = {};
      const serviceResult = {
        data: [],
        meta: {
          pagination: { total: 0, offset: 0, limit: 10 },
        },
      };

      postService.getPostsByUserId.mockResolvedValue(serviceResult);

      // Act
      await controller.getPostsByUser(currentUser, userId, query as any);

      // Assert
      expect(postService.getPostsByUserId).toHaveBeenCalledWith(
        userId,
        currentUser.id,
        currentUser.role,
        {
          offset: 0,
          limit: 10,
        }
      );
    });
  });
});
