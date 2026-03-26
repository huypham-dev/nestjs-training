import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { CacheService } from '@/common/services';
import { UserStatus } from '@/constants/users';
import {
  createUserFixture,
  createAdminUserFixture,
} from '@/test/fixtures/user.fixture';

describe('UserController', () => {
  let controller: UserController;
  let userService: jest.Mocked<UserService>;

  beforeEach(async () => {
    // Create mock service
    const mockUserService = {
      getAllUsers: jest.fn(),
      updateUserByAuthId: jest.fn(),
      updateUserStatus: jest.fn(),
    };

    const mockCacheService = {
      invalidate: jest.fn(),
      invalidatePattern: jest.fn(),
      invalidateUserCaches: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    userService = module.get(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllUsers', () => {
    it('should return paginated users list', async () => {
      // Arrange
      const users = [createUserFixture(), createAdminUserFixture()];
      const pagination = { offset: 0, limit: 10 };
      const serviceResult = {
        data: users,
        meta: {
          pagination: {
            total: 2,
            offset: 0,
            limit: 10,
          },
        },
      };

      userService.getAllUsers.mockResolvedValue(serviceResult);

      // Act
      const result = await controller.getAllUsers(pagination);

      // Assert
      expect(result).toEqual({
        data: users.map((user) => ({
          id: user.id,
          authId: user.authId,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          status: user.status,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        })),
        meta: serviceResult.meta,
      });
      expect(userService.getAllUsers).toHaveBeenCalledWith({
        offset: 0,
        limit: 10,
      });
    });

    it('should use default pagination values when not provided', async () => {
      // Arrange
      const users = [createUserFixture()];
      const serviceResult = {
        data: users,
        meta: {
          pagination: {
            total: 1,
            offset: 0,
            limit: 10,
          },
        },
      };

      userService.getAllUsers.mockResolvedValue(serviceResult);

      // Act
      await controller.getAllUsers({ offset: 0, limit: 10 });

      // Assert
      expect(userService.getAllUsers).toHaveBeenCalledWith({
        offset: 0,
        limit: 10,
      });
    });

    it('should return empty data array when no users found', async () => {
      // Arrange
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

      userService.getAllUsers.mockResolvedValue(serviceResult);

      // Act
      const result = await controller.getAllUsers({ offset: 0, limit: 10 });

      // Assert
      expect(result.data).toEqual([]);
      expect(result.meta?.pagination.total).toBe(0);
    });
  });

  describe('getCurrentUser', () => {
    it('should return current authenticated user', () => {
      // Arrange
      const user = createUserFixture();

      // Act
      const result = controller.getCurrentUser(user);

      // Assert
      expect(result).toEqual({
        data: user,
      });
    });
  });

  describe('updateCurrentUser', () => {
    it('should update current user information', async () => {
      // Arrange
      const currentUser = createUserFixture();
      const updateData = {
        fullName: 'Updated Name',
        email: 'updated@example.com',
      };
      const updatedUser = createUserFixture({
        ...currentUser,
        ...updateData,
      });

      userService.updateUserByAuthId.mockResolvedValue(updatedUser);

      // Act
      const result = await controller.updateCurrentUser(
        currentUser,
        updateData
      );

      // Assert
      expect(result).toEqual({
        data: updatedUser,
      });
      expect(userService.updateUserByAuthId).toHaveBeenCalledWith(
        currentUser.authId,
        updateData
      );
    });

    it('should update only fullName when email not provided', async () => {
      // Arrange
      const currentUser = createUserFixture();
      const updateData = { fullName: 'New Name' };
      const updatedUser = createUserFixture({
        ...currentUser,
        fullName: 'New Name',
      });

      userService.updateUserByAuthId.mockResolvedValue(updatedUser);

      // Act
      const result = await controller.updateCurrentUser(
        currentUser,
        updateData
      );

      // Assert
      expect(result.data.fullName).toBe('New Name');
      expect(userService.updateUserByAuthId).toHaveBeenCalledWith(
        currentUser.authId,
        updateData
      );
    });
  });

  describe('updateUserStatus', () => {
    it('should update user status successfully', async () => {
      // Arrange
      const userId = 'user-123';
      const payload = { status: UserStatus.INACTIVE };
      const updatedUser = createUserFixture({
        id: userId,
        status: UserStatus.INACTIVE,
      });

      userService.updateUserStatus.mockResolvedValue(updatedUser);

      // Act
      const result = await controller.updateUserStatus(userId, payload);

      // Assert
      expect(result).toEqual({
        data: {
          success: true,
        },
      });
      expect(userService.updateUserStatus).toHaveBeenCalledWith(
        userId,
        UserStatus.INACTIVE
      );
    });

    it('should update user status to active', async () => {
      // Arrange
      const userId = 'user-456';
      const payload = { status: UserStatus.ACTIVE };
      const updatedUser = createUserFixture({
        id: userId,
        status: UserStatus.ACTIVE,
      });

      userService.updateUserStatus.mockResolvedValue(updatedUser);

      // Act
      const result = await controller.updateUserStatus(userId, payload);

      // Assert
      expect(result.data.success).toBe(true);
      expect(userService.updateUserStatus).toHaveBeenCalledWith(
        userId,
        UserStatus.ACTIVE
      );
    });
  });
});
