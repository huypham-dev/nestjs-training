// Dependencies
import { MikroORM } from '@mikro-orm/core';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WebhookEvent } from '@clerk/backend';

// Modules
import { TestAppModule } from '../support/test-app.module';

// Controllers
import { WebhookController } from '@/modules/webhook/webhook.controller';

// Services
import { ClerkService } from '@/shared/services/clerk/clerk.service';
import { UserService } from '@/modules/user/user.service';
import { WebhookService } from '@/modules/webhook/webhook.service';

// Decorators & Constants
import { UserStatus, CLERK_WEBHOOK_EVENTS } from '@/constants';

// Helpers
import { createSupertestApp } from '../helpers/test.helper';
import { createUserFixture } from '@/test/fixtures/user.fixture';

describe('WebhookController (e2e)', () => {
  let app: INestApplication;
  let orm: MikroORM;
  let clerkService: ClerkService;
  let userService: UserService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
      controllers: [WebhookController],
      providers: [WebhookService],
    })
      .overrideProvider(ClerkService)
      .useValue({
        verifyWebhook: jest.fn(),
        lockUser: jest.fn(),
        unlockUser: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    orm = moduleFixture.get(MikroORM);
    clerkService = moduleFixture.get(ClerkService);
    userService = moduleFixture.get(UserService);

    await app.init();
  });

  afterAll(async () => {
    if (orm) {
      await orm.close(true);
    }
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('/webhooks/clerk (POST)', () => {
    const defaultHeaders = {
      'svix-id': 'msg_123',
      'svix-timestamp': new Date().toISOString(),
      'svix-signature': 'v1,test-signature',
      'Content-Type': 'application/json',
    };

    it('should return 200 OK for a successfully verified webhook', async () => {
      // Return a basic event
      jest.spyOn(clerkService, 'verifyWebhook').mockReturnValue({
        type: 'some.other.event',
        data: {},
      } as any);

      const requestAction = createSupertestApp(app)
        .post('/webhooks/clerk')
        .set(defaultHeaders)
        .send({ data: 'anything' });

      const response = await requestAction;

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: { received: true } });
      expect(clerkService.verifyWebhook).toHaveBeenCalled();
    });

    it('should process user.updated event and update user status in DB', async () => {
      // Mock the DB lookup to return a fake user
      const fakeUser = createUserFixture({
        id: 'user-123',
        status: UserStatus.ACTIVE,
      });
      jest
        .spyOn(userService, 'getUserByAuthId')
        .mockResolvedValue(fakeUser as any);
      const updateSpy = jest
        .spyOn(userService, 'updateUserFromWebhook')
        .mockResolvedValue(undefined as any);

      // Tell clerk verification to return a simulated clerk payload where an account is locked
      jest.spyOn(clerkService, 'verifyWebhook').mockReturnValue({
        type: CLERK_WEBHOOK_EVENTS.USER_UPDATED,
        data: {
          id: 'clerk_auth_123',
          locked: true,
          image_url: 'https://img.clerk.com/avatar.jpg',
        },
      } as WebhookEvent);

      const response = await createSupertestApp(app)
        .post('/webhooks/clerk')
        .set(defaultHeaders)
        .send({ data: 'payload doesnt matter since verify is mocked' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: { received: true } });

      // Ensure the service looked up the exact clerk id sent in the mocked verify return
      expect(userService.getUserByAuthId).toHaveBeenCalledWith(
        'clerk_auth_123'
      );

      // Ensure the DB update method was triggered to sync the changes (from ACTIVE to INACTIVE because locked=true)
      expect(updateSpy).toHaveBeenCalledWith('user-123', {
        status: UserStatus.INACTIVE,
        avatarUrl: 'https://img.clerk.com/avatar.jpg',
      });
    });

    it('should return 500 error if signature verification fails to allow Clerk retry', async () => {
      // Simulate clerk service rejecting the webhook due to invalid signature
      jest.spyOn(clerkService, 'verifyWebhook').mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const response = await createSupertestApp(app)
        .post('/webhooks/clerk')
        .set(defaultHeaders)
        .send({ data: 'bad payload' });

      // Should return error to allow Clerk to retry the webhook
      expect(response.status).toBe(500);
    });
  });
});
