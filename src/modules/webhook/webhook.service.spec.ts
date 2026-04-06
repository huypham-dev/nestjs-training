import { Test, TestingModule } from '@nestjs/testing';
import { WebhookService } from './webhook.service';
import { ClerkService } from '@/shared/services';
import { UserService } from '../user/user.service';
import { UserStatus, CLERK_WEBHOOK_EVENTS } from '@/constants';
import { WebhookEvent } from '@clerk/backend';

describe('WebhookService', () => {
  let service: WebhookService;
  let clerkService: jest.Mocked<ClerkService>;
  let userService: jest.Mocked<UserService>;

  beforeEach(async () => {
    const mockClerkService = {
      verifyWebhook: jest.fn(),
    };

    const mockUserService = {
      getUserByAuthId: jest.fn(),
      updateUserFromWebhook: jest.fn(),
      deleteUserByAuthId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: ClerkService,
          useValue: mockClerkService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
    clerkService = module.get(ClerkService);
    userService = module.get(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verifyAndProcess', () => {
    it('should verify payload and process event successfully', async () => {
      const mockEvent = {
        type: 'organization.created',
      } as unknown as WebhookEvent;
      clerkService.verifyWebhook.mockReturnValue(mockEvent);

      await service.verifyAndProcess('payload', 'id', 'timestamp', 'sig');

      expect(clerkService.verifyWebhook).toHaveBeenCalledWith(
        'payload',
        'id',
        'timestamp',
        'sig'
      );
    });
  });

  describe('handleUserUpdated', () => {
    const mockEvent = {
      type: CLERK_WEBHOOK_EVENTS.USER_UPDATED,
      data: {
        id: 'auth-123',
        locked: false,
        image_url: 'http://example.com/avatar.jpg',
      },
    } as unknown as WebhookEvent;

    it('should abort if event type is not user.updated', async () => {
      const invalidEvent = {
        type: 'user.created',
        data: {},
      } as unknown as WebhookEvent;

      // We process via processEvent internally, but testing behavior if handleUserUpdated is somehow called directly
      await (service as any).handleUserUpdated(invalidEvent);

      expect(userService.getUserByAuthId).not.toHaveBeenCalled();
    });

    it('should abort if authId is missing from data', async () => {
      const invalidEvent = {
        type: CLERK_WEBHOOK_EVENTS.USER_UPDATED,
        data: {},
      } as unknown as WebhookEvent;

      await (service as any).handleUserUpdated(invalidEvent);

      expect(userService.getUserByAuthId).not.toHaveBeenCalled();
    });

    it('should abort if user is not found in database', async () => {
      userService.getUserByAuthId.mockResolvedValue(null);

      await (service as any).handleUserUpdated(mockEvent);

      expect(userService.getUserByAuthId).toHaveBeenCalledWith('auth-123');
      expect(userService.updateUserFromWebhook).not.toHaveBeenCalled();
    });

    it('should update user status to INACTIVE if locked is true', async () => {
      const user: any = {
        id: 'db-123',
        status: UserStatus.ACTIVE,
        avatarUrl: 'http://example.com/avatar.jpg',
      };
      userService.getUserByAuthId.mockResolvedValue(user);

      const lockedEvent = {
        ...mockEvent,
        data: { ...mockEvent.data, locked: true },
      } as unknown as WebhookEvent;

      await (service as any).handleUserUpdated(lockedEvent);

      expect(userService.updateUserFromWebhook).toHaveBeenCalledWith('db-123', {
        status: UserStatus.INACTIVE,
      });
    });

    it('should update avatarUrl if it has changed', async () => {
      const user: any = {
        id: 'db-123',
        status: UserStatus.ACTIVE,
        avatarUrl: 'old-avatar.jpg',
      };
      userService.getUserByAuthId.mockResolvedValue(user);

      await (service as any).handleUserUpdated(mockEvent);

      expect(userService.updateUserFromWebhook).toHaveBeenCalledWith('db-123', {
        avatarUrl: 'http://example.com/avatar.jpg',
      });
    });

    it('should update both status and avatarUrl if both changed', async () => {
      const user: any = {
        id: 'db-123',
        status: UserStatus.ACTIVE,
        avatarUrl: 'old-avatar.jpg',
      };
      userService.getUserByAuthId.mockResolvedValue(user);

      const lockedEvent = {
        ...mockEvent,
        data: {
          ...mockEvent.data,
          locked: true,
          image_url: 'new-locked-avatar.jpg',
        },
      } as unknown as WebhookEvent;

      await (service as any).handleUserUpdated(lockedEvent);

      expect(userService.updateUserFromWebhook).toHaveBeenCalledWith('db-123', {
        status: UserStatus.INACTIVE,
        avatarUrl: 'new-locked-avatar.jpg',
      });
    });

    it('should not update if no changes are detected', async () => {
      const user: any = {
        id: 'db-123',
        status: UserStatus.ACTIVE,
        avatarUrl: 'http://example.com/avatar.jpg',
      };
      userService.getUserByAuthId.mockResolvedValue(user);

      await (service as any).handleUserUpdated(mockEvent);

      expect(userService.updateUserFromWebhook).not.toHaveBeenCalled();
    });
  });

  describe('handleUserDeleted', () => {
    const mockEvent = {
      type: CLERK_WEBHOOK_EVENTS.USER_DELETED,
      data: {
        id: 'auth-123',
      },
    } as unknown as WebhookEvent;

    it('should abort if event type is not user.deleted', async () => {
      const invalidEvent = {
        type: 'user.created',
        data: {},
      } as unknown as WebhookEvent;

      await (service as any).handleUserDeleted(invalidEvent);

      expect(userService.deleteUserByAuthId).not.toHaveBeenCalled();
    });

    it('should abort if authId is missing from data', async () => {
      const invalidEvent = {
        type: CLERK_WEBHOOK_EVENTS.USER_DELETED,
        data: {},
      } as unknown as WebhookEvent;

      await (service as any).handleUserDeleted(invalidEvent);

      expect(userService.deleteUserByAuthId).not.toHaveBeenCalled();
    });

    it('should delete user from database when user.deleted event is received', async () => {
      userService.deleteUserByAuthId.mockResolvedValue(undefined);

      await (service as any).handleUserDeleted(mockEvent);

      expect(userService.deleteUserByAuthId).toHaveBeenCalledWith('auth-123');
    });

    it('should handle errors during user deletion', async () => {
      const error = new Error('Database error');
      userService.deleteUserByAuthId.mockRejectedValue(error);

      await expect(
        (service as any).handleUserDeleted(mockEvent)
      ).rejects.toThrow('Database error');

      expect(userService.deleteUserByAuthId).toHaveBeenCalledWith('auth-123');
    });
  });
});
