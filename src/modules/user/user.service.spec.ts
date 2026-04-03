import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@mikro-orm/nestjs';
import { EntityManager } from '@mikro-orm/core';

import { UserService } from './user.service';
import { User } from './user.entity';
import { UserStatus } from '@/constants/users';
import { ResourceNotFoundException } from '@/common/exceptions';
import { ClerkService } from '@/shared/services';

import {
  createMockRepository,
  createMockEntityManager,
} from '@/test/mocks/repository.mock';
import {
  createUserFixture,
  createAdminUserFixture,
  createInactiveUserFixture,
} from '@/test/fixtures/user.fixture';

describe('UserService', () => {
  let service: UserService;
  let userRepository: ReturnType<typeof createMockRepository>;
  let entityManager: ReturnType<typeof createMockEntityManager>;
  let clerkService: jest.Mocked<ClerkService>;

  beforeEach(async () => {
    // Create mock instances
    userRepository = createMockRepository();
    entityManager = createMockEntityManager();

    // Mock ClerkService
    const mockClerkService = {
      lockUser: jest.fn().mockResolvedValue(undefined),
      unlockUser: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
        {
          provide: EntityManager,
          useValue: entityManager,
        },
        {
          provide: ClerkService,
          useValue: mockClerkService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    clerkService = module.get(ClerkService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllUsers', () => {
    it('should return paginated list of users with meta', async () => {
      // Arrange
      const users = [createUserFixture(), createAdminUserFixture()];
      const total = 2;
      userRepository.findAndCount.mockResolvedValue([users, total]);

      // Act
      const result = await service.getAllUsers({ offset: 0, limit: 10 });

      // Assert
      expect(result.data).toEqual(users);
      expect(result.meta).toEqual({
        pagination: {
          offset: 0,
          limit: 10,
          total: 2,
        },
      });
      expect(userRepository.findAndCount).toHaveBeenCalledWith(
        {},
        {
          offset: 0,
          limit: 10,
          orderBy: { createdAt: 'DESC' },
        }
      );
    });

    it('should use default pagination values when not provided', async () => {
      // Arrange
      userRepository.findAndCount.mockResolvedValue([[], 0]);

      // Act
      await service.getAllUsers();

      // Assert
      expect(userRepository.findAndCount).toHaveBeenCalledWith(
        {},
        {
          offset: 0,
          limit: 10,
          orderBy: { createdAt: 'DESC' },
        }
      );
    });

    it('should return empty data without meta when no users found', async () => {
      // Arrange
      userRepository.findAndCount.mockResolvedValue([[], 0]);

      // Act
      const result = await service.getAllUsers();

      // Assert
      expect(result.data).toEqual([]);
      expect(result.meta).toBeUndefined();
    });
  });

  describe('getUserById', () => {
    it('should return user when found by id', async () => {
      // Arrange
      const user = createUserFixture();
      userRepository.findOne.mockResolvedValue(user);

      // Act
      const result = await service.getUserById('user-123');

      // Assert
      expect(result).toEqual(user);
      expect(userRepository.findOne).toHaveBeenCalledWith({ id: 'user-123' });
    });

    it('should throw ResourceNotFoundException when user not found', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getUserById('non-existent')).rejects.toThrow(
        ResourceNotFoundException
      );
    });
  });

  describe('updateUserById', () => {
    it('should update user fullName and email', async () => {
      // Arrange
      const user = createUserFixture();
      userRepository.findOne.mockResolvedValue(user);
      entityManager.flush.mockResolvedValue(undefined);

      const payload = {
        fullName: 'Updated Name',
        email: 'updated@example.com',
      };

      // Act
      const result = await service.updateUserById(user.id, payload);

      // Assert
      expect(result.fullName).toBe('Updated Name');
      expect(result.email).toBe('updated@example.com');
      expect(entityManager.flush).toHaveBeenCalled();
    });

    it('should update only provided fields', async () => {
      // Arrange
      const user = createUserFixture({ email: 'original@example.com' });
      userRepository.findOne.mockResolvedValue(user);
      entityManager.flush.mockResolvedValue(undefined);

      // Act
      const result = await service.updateUserById(user.id, {
        fullName: 'New Name',
      });

      // Assert
      expect(result.fullName).toBe('New Name');
      expect(result.email).toBe('original@example.com'); // unchanged
      expect(entityManager.flush).toHaveBeenCalled();
    });

    it('should throw ResourceNotFoundException when user not found', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.updateUserById('non-existent', { fullName: 'Test' })
      ).rejects.toThrow(ResourceNotFoundException);
    });
  });

  describe('updateUserStatus', () => {
    it('should update user status to INACTIVE', async () => {
      // Arrange
      const user = createUserFixture();
      userRepository.findOne.mockResolvedValue(user);
      entityManager.flush.mockResolvedValue(undefined);

      // Act
      const result = await service.updateUserStatus(
        'user-123',
        UserStatus.INACTIVE
      );

      // Assert
      expect(result.status).toBe(UserStatus.INACTIVE);
      expect(entityManager.flush).toHaveBeenCalled();
      expect(clerkService.lockUser).toHaveBeenCalledWith(user.authId);
    });

    it('should update user status to ACTIVE', async () => {
      // Arrange
      const user = createInactiveUserFixture();
      userRepository.findOne.mockResolvedValue(user);
      entityManager.flush.mockResolvedValue(undefined);

      // Act
      const result = await service.updateUserStatus(
        'user-123',
        UserStatus.ACTIVE
      );

      // Assert
      expect(result.status).toBe(UserStatus.ACTIVE);
      expect(entityManager.flush).toHaveBeenCalled();
      expect(clerkService.unlockUser).toHaveBeenCalledWith(user.authId);
    });

    it('should throw ResourceNotFoundException when user not found', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.updateUserStatus('non-existent', UserStatus.INACTIVE)
      ).rejects.toThrow(ResourceNotFoundException);
    });

    it('should rollback database change if Clerk lock operation fails', async () => {
      // Arrange
      const user = createUserFixture({ status: UserStatus.ACTIVE });
      userRepository.findOne.mockResolvedValue(user);
      entityManager.flush.mockResolvedValue(undefined);
      clerkService.lockUser.mockRejectedValue(
        new Error('Failed to lock user on Clerk')
      );

      // Act & Assert
      await expect(
        service.updateUserStatus('user-123', UserStatus.INACTIVE)
      ).rejects.toThrow('Failed to lock user on Clerk');

      // Verify rollback
      expect(user.status).toBe(UserStatus.ACTIVE);
      expect(entityManager.flush).toHaveBeenCalledTimes(1); // Once for rollback only
    });

    it('should rollback database change if Clerk unlock operation fails', async () => {
      // Arrange
      const user = createInactiveUserFixture();
      userRepository.findOne.mockResolvedValue(user);
      entityManager.flush.mockResolvedValue(undefined);
      clerkService.unlockUser.mockRejectedValue(
        new Error('Failed to unlock user on Clerk')
      );

      // Act & Assert
      await expect(
        service.updateUserStatus('user-123', UserStatus.ACTIVE)
      ).rejects.toThrow('Failed to unlock user on Clerk');

      // Verify rollback
      expect(user.status).toBe(UserStatus.INACTIVE);
      expect(entityManager.flush).toHaveBeenCalledTimes(1); // Once for rollback only
    });
  });

  describe('syncUser', () => {
    it('should return existing user if found', async () => {
      // Arrange
      const existingUser = createUserFixture();
      userRepository.findOne.mockResolvedValue(existingUser);

      // Act
      const result = await service.syncUser(
        'auth-123',
        'test@example.com',
        'Test User'
      );

      // Assert
      expect(result).toEqual(existingUser);
      expect(userRepository.create).not.toHaveBeenCalled();
      expect(entityManager.flush).not.toHaveBeenCalled();
    });

    it('should create new user if not found', async () => {
      // Arrange
      const newUser = createUserFixture({
        authId: 'new-auth-123',
        email: 'new@example.com',
        fullName: 'New User',
      });
      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockReturnValue(newUser);
      entityManager.flush.mockResolvedValue(undefined);

      // Act
      const result = await service.syncUser(
        'new-auth-123',
        'new@example.com',
        'New User'
      );

      // Assert
      expect(result).toEqual(newUser);
      expect(userRepository.create).toHaveBeenCalledWith({
        authId: 'new-auth-123',
        email: 'new@example.com',
        fullName: 'New User',
      });
      expect(entityManager.flush).toHaveBeenCalled();
    });

    it('should create user with empty email and fullName if not provided', async () => {
      // Arrange
      const newUser = createUserFixture({
        authId: 'new-auth-123',
        email: '',
        fullName: '',
      });
      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockReturnValue(newUser);
      entityManager.flush.mockResolvedValue(undefined);

      // Act
      await service.syncUser('new-auth-123');

      // Assert
      expect(userRepository.create).toHaveBeenCalledWith({
        authId: 'new-auth-123',
        email: '',
        fullName: '',
      });
      expect(entityManager.flush).toHaveBeenCalled();
    });
  });
});
