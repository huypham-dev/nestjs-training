import { Test, TestingModule } from '@nestjs/testing';
import { ClerkService } from './clerk.service';
import { ConfigService } from '@nestjs/config';
import { Webhook } from 'svix';
import { createClerkClient } from '@clerk/backend';

jest.mock('@clerk/backend', () => ({
  createClerkClient: jest.fn().mockReturnValue({
    users: {
      lockUser: jest.fn(),
      unlockUser: jest.fn(),
    },
  }),
}));

jest.mock('svix', () => ({
  Webhook: jest.fn().mockImplementation(() => ({
    verify: jest.fn(),
  })),
}));

describe('ClerkService', () => {
  let service: ClerkService;
  let mockClerkClient: any;
  let mockWebhookVerify: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockWebhookVerify = jest.fn();
    (Webhook as jest.Mock).mockImplementation(() => ({
      verify: mockWebhookVerify,
    }));

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'CLERK_SECRET_KEY') return 'test-clerk-secret';
        if (key === 'CLERK_WEBHOOK_SECRET') return 'test-webhook-secret';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClerkService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ClerkService>(ClerkService);

    // createClerkClient gets called in the constructor
    mockClerkClient = (createClerkClient as jest.Mock).mock.results[0].value;
  });

  describe('Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize clerk client with secret key', () => {
      expect(createClerkClient).toHaveBeenCalledWith({
        secretKey: 'test-clerk-secret',
      });
    });
  });

  describe('verifyWebhook', () => {
    it('should successfully verify webhook signature', () => {
      const mockEvent = { type: 'user.updated' };
      mockWebhookVerify.mockReturnValue(mockEvent);

      const result = service.verifyWebhook(
        'payload',
        'svix-id',
        'svix-timestamp',
        'svix-signature'
      );

      expect(Webhook).toHaveBeenCalledWith('test-webhook-secret');
      expect(mockWebhookVerify).toHaveBeenCalledWith('payload', {
        'svix-id': 'svix-id',
        'svix-timestamp': 'svix-timestamp',
        'svix-signature': 'svix-signature',
      });
      expect(result).toEqual(mockEvent);
    });

    it('should throw an error if webhook signature is invalid', () => {
      mockWebhookVerify.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      expect(() => {
        service.verifyWebhook(
          'payload',
          'svix-id',
          'svix-timestamp',
          'invalid-signature'
        );
      }).toThrow('Invalid webhook signature');
    });

    it('should throw an error if webhook secret is missing', async () => {
      // Create a fresh module with missing webhook secret to test constructor & verify method behavior
      const missingSecretConfig = {
        get: jest.fn((key) => {
          if (key === 'CLERK_WEBHOOK_SECRET') return '';
          return 'test';
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ClerkService,
          { provide: ConfigService, useValue: missingSecretConfig },
        ],
      }).compile();

      const newService = module.get<ClerkService>(ClerkService);

      expect(() => {
        newService.verifyWebhook('payload', 'svix-id', 'svix-timestamp', 'sig');
      }).toThrow('CLERK_WEBHOOK_SECRET is not configured');
    });
  });

  describe('lockUser', () => {
    it('should successfully lock user', async () => {
      mockClerkClient.users.lockUser.mockResolvedValue({});

      await service.lockUser('user_123');

      expect(mockClerkClient.users.lockUser).toHaveBeenCalledWith('user_123');
    });

    it('should throw error if locking fails', async () => {
      mockClerkClient.users.lockUser.mockRejectedValue(
        new Error('Clerk API Error')
      );

      await expect(service.lockUser('user_123')).rejects.toThrow(
        'Failed to lock user on Clerk'
      );
    });
  });

  describe('unlockUser', () => {
    it('should successfully unlock user', async () => {
      mockClerkClient.users.unlockUser.mockResolvedValue({});

      await service.unlockUser('user_123');

      expect(mockClerkClient.users.unlockUser).toHaveBeenCalledWith('user_123');
    });

    it('should throw error if unlocking fails', async () => {
      mockClerkClient.users.unlockUser.mockRejectedValue(
        new Error('Clerk API Error')
      );

      await expect(service.unlockUser('user_123')).rejects.toThrow(
        'Failed to unlock user on Clerk'
      );
    });
  });
});
