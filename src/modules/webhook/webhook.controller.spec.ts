import { Test, TestingModule } from '@nestjs/testing';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

describe('WebhookController', () => {
  let controller: WebhookController;
  let webhookService: jest.Mocked<WebhookService>;

  beforeEach(async () => {
    const mockWebhookService = {
      verifyAndProcess: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        {
          provide: WebhookService,
          useValue: mockWebhookService,
        },
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
    webhookService = module.get(WebhookService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleClerkWebhook', () => {
    it('should successfully process a valid payload with rawBody', async () => {
      // Arrange
      const svixId = 'msg_123';
      const svixTimestamp = '123456789';
      const svixSignature = 'v1,signature123';
      const req: any = {
        rawBody: Buffer.from('{"data": "test"}'),
      };

      webhookService.verifyAndProcess.mockResolvedValue();

      // Act
      const result = await controller.handleClerkWebhook(
        svixId,
        svixTimestamp,
        svixSignature,
        req
      );

      // Assert
      expect(result).toEqual({ received: true });
      expect(webhookService.verifyAndProcess).toHaveBeenCalledWith(
        '{"data": "test"}',
        svixId,
        svixTimestamp,
        svixSignature
      );
    });

    it('should fallback to JSON.stringify if rawBody is not present', async () => {
      // Arrange
      const svixId = 'msg_123';
      const svixTimestamp = '123456789';
      const svixSignature = 'v1,signature123';
      const req: any = {
        body: { data: 'test' },
      };

      webhookService.verifyAndProcess.mockResolvedValue();

      // Act
      const result = await controller.handleClerkWebhook(
        svixId,
        svixTimestamp,
        svixSignature,
        req
      );

      // Assert
      expect(result).toEqual({ received: true });
      expect(webhookService.verifyAndProcess).toHaveBeenCalledWith(
        '{"data":"test"}',
        svixId,
        svixTimestamp,
        svixSignature
      );
    });

    it('should throw error if verification fails to allow Clerk retry', async () => {
      // Arrange
      const svixId = 'msg_123';
      const svixTimestamp = '123456789';
      const svixSignature = 'v1,signature123';
      const req: any = {
        rawBody: Buffer.from('{"data": "test"}'),
      };

      webhookService.verifyAndProcess.mockRejectedValue(
        new Error('Invalid signature')
      );

      // Act & Assert
      await expect(
        controller.handleClerkWebhook(svixId, svixTimestamp, svixSignature, req)
      ).rejects.toThrow('Invalid signature');
    });

    it('should throw error if processing fails to allow Clerk retry', async () => {
      // Arrange
      const svixId = 'msg_123';
      const svixTimestamp = '123456789';
      const svixSignature = 'v1,signature123';
      const req: any = {
        rawBody: Buffer.from('{"data": "test"}'),
      };

      webhookService.verifyAndProcess.mockRejectedValue(
        new Error('Database error')
      );

      // Act & Assert
      await expect(
        controller.handleClerkWebhook(svixId, svixTimestamp, svixSignature, req)
      ).rejects.toThrow('Database error');
    });
  });
});
