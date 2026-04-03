// Dependencies
import { ExecutionContext } from '@nestjs/common';

// Common
import {
  AuthenticationException,
  AuthorizationException,
  ResourceNotFoundException,
} from '@/common/exceptions';

// Guards
import { PostOwnerGuard, PostOwnerOrAdminGuard } from './post.guards';

// Other
import { createPostFixture } from '@/test/fixtures/post.fixture';
import {
  createUserFixture,
  createAdminUserFixture,
} from '@/test/fixtures/user.fixture';
import { createMockRepository } from '@/test/mocks/repository.mock';

describe('PostOwnerGuard', () => {
  let guard: PostOwnerGuard;
  let postRepository: ReturnType<typeof createMockRepository>;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;

  beforeEach(() => {
    postRepository = createMockRepository();
    guard = new PostOwnerGuard(postRepository as any);

    // Mock ExecutionContext
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn(),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should throw AuthenticationException when user is not authenticated', async () => {
      // Arrange
      (
        mockExecutionContext.switchToHttp().getRequest as jest.Mock
      ).mockReturnValue({
        user: null,
        params: { id: 'post-123' },
      });

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        AuthenticationException
      );
    });

    it('should allow access when no post ID in params', async () => {
      // Arrange
      const user = createUserFixture();
      (
        mockExecutionContext.switchToHttp().getRequest as jest.Mock
      ).mockReturnValue({
        user,
        params: {},
      });

      // Act
      const result = await guard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(true);
      expect(postRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw ResourceNotFoundException when post does not exist', async () => {
      // Arrange
      const user = createUserFixture();
      postRepository.findOne.mockResolvedValue(null);
      (
        mockExecutionContext.switchToHttp().getRequest as jest.Mock
      ).mockReturnValue({
        user,
        params: { id: 'non-existent-post' },
      });

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        ResourceNotFoundException
      );
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        'Post with ID non-existent-post not found'
      );
    });

    it('should allow access when user is the post owner', async () => {
      // Arrange
      const user = createUserFixture({ id: 'user-123' });
      const post = createPostFixture({
        user,
      });
      postRepository.findOne.mockResolvedValue(post);
      (
        mockExecutionContext.switchToHttp().getRequest as jest.Mock
      ).mockReturnValue({
        user,
        params: { id: 'post-123' },
      });

      // Act
      const result = await guard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(true);
      expect(postRepository.findOne).toHaveBeenCalledWith(
        { id: 'post-123' },
        { populate: ['user'] }
      );
    });

    it('should throw AuthorizationException when user is admin but not owner', async () => {
      // Arrange
      const adminUser = createAdminUserFixture({ id: 'admin-123' });
      const postOwner = createUserFixture({ id: 'owner-456' });
      const post = createPostFixture({
        user: postOwner,
      });
      postRepository.findOne.mockResolvedValue(post);
      (
        mockExecutionContext.switchToHttp().getRequest as jest.Mock
      ).mockReturnValue({
        user: adminUser,
        params: { id: 'post-123' },
      });

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        AuthorizationException
      );
    });

    it('should throw AuthorizationException when user is not the owner', async () => {
      // Arrange
      const currentUser = createUserFixture({ id: 'user-123' });
      const postOwner = createUserFixture({ id: 'owner-456' });
      const post = createPostFixture({
        user: postOwner,
      });
      postRepository.findOne.mockResolvedValue(post);
      (
        mockExecutionContext.switchToHttp().getRequest as jest.Mock
      ).mockReturnValue({
        user: currentUser,
        params: { id: 'post-123' },
      });

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        AuthorizationException
      );
    });

    it('should populate user relation when checking post', async () => {
      // Arrange
      const user = createUserFixture({ id: 'user-123' });
      const post = createPostFixture({ user });
      postRepository.findOne.mockResolvedValue(post);
      (
        mockExecutionContext.switchToHttp().getRequest as jest.Mock
      ).mockReturnValue({
        user,
        params: { id: 'post-123' },
      });

      // Act
      await guard.canActivate(mockExecutionContext);

      // Assert
      expect(postRepository.findOne).toHaveBeenCalledWith(
        { id: 'post-123' },
        { populate: ['user'] }
      );
    });
  });
});

describe('PostOwnerOrAdminGuard', () => {
  let guard: PostOwnerOrAdminGuard;
  let postRepository: ReturnType<typeof createMockRepository>;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;

  beforeEach(() => {
    postRepository = createMockRepository();
    guard = new PostOwnerOrAdminGuard(postRepository as any);

    // Mock ExecutionContext
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn(),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should throw AuthenticationException when user is not authenticated', async () => {
      // Arrange
      (
        mockExecutionContext.switchToHttp().getRequest as jest.Mock
      ).mockReturnValue({
        user: null,
        params: { id: 'post-123' },
      });

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        AuthenticationException
      );
    });

    it('should allow access when no post ID in params', async () => {
      // Arrange
      const user = createUserFixture();
      (
        mockExecutionContext.switchToHttp().getRequest as jest.Mock
      ).mockReturnValue({
        user,
        params: {},
      });

      // Act
      const result = await guard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(true);
      expect(postRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw ResourceNotFoundException when post does not exist', async () => {
      // Arrange
      const user = createUserFixture();
      postRepository.findOne.mockResolvedValue(null);
      (
        mockExecutionContext.switchToHttp().getRequest as jest.Mock
      ).mockReturnValue({
        user,
        params: { id: 'non-existent-post' },
      });

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        ResourceNotFoundException
      );
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        'Post with ID non-existent-post not found'
      );
    });

    it('should allow access when user is the post owner', async () => {
      // Arrange
      const user = createUserFixture({ id: 'user-123' });
      const post = createPostFixture({
        user,
      });
      postRepository.findOne.mockResolvedValue(post);
      (
        mockExecutionContext.switchToHttp().getRequest as jest.Mock
      ).mockReturnValue({
        user,
        params: { id: 'post-123' },
      });

      // Act
      const result = await guard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(true);
      expect(postRepository.findOne).toHaveBeenCalledWith(
        { id: 'post-123' },
        { populate: ['user'] }
      );
    });

    it('should allow access when user is admin', async () => {
      // Arrange
      const adminUser = createAdminUserFixture({ id: 'admin-123' });
      const postOwner = createUserFixture({ id: 'owner-456' });
      const post = createPostFixture({
        user: postOwner,
      });
      postRepository.findOne.mockResolvedValue(post);
      (
        mockExecutionContext.switchToHttp().getRequest as jest.Mock
      ).mockReturnValue({
        user: adminUser,
        params: { id: 'post-123' },
      });

      // Act
      const result = await guard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should throw AuthorizationException when user is neither owner nor admin', async () => {
      // Arrange
      const currentUser = createUserFixture({ id: 'user-123' });
      const postOwner = createUserFixture({ id: 'owner-456' });
      const post = createPostFixture({
        user: postOwner,
      });
      postRepository.findOne.mockResolvedValue(post);
      (
        mockExecutionContext.switchToHttp().getRequest as jest.Mock
      ).mockReturnValue({
        user: currentUser,
        params: { id: 'post-123' },
      });

      // Act & Assert
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        AuthorizationException
      );
    });

    it('should populate user relation when checking post', async () => {
      // Arrange
      const user = createUserFixture({ id: 'user-123' });
      const post = createPostFixture({ user });
      postRepository.findOne.mockResolvedValue(post);
      (
        mockExecutionContext.switchToHttp().getRequest as jest.Mock
      ).mockReturnValue({
        user,
        params: { id: 'post-123' },
      });

      // Act
      await guard.canActivate(mockExecutionContext);

      // Assert
      expect(postRepository.findOne).toHaveBeenCalledWith(
        { id: 'post-123' },
        { populate: ['user'] }
      );
    });
  });
});
