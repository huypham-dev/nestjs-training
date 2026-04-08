// Dependencies
import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
} from '@nestjs/common';

// Common
import { Public } from '@/common/decorators';

// Services
import { WebhookService } from './webhook.service';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

  /**
   * Handle Clerk webhook events
   *
   * Receives and processes webhook events from Clerk authentication service.
   * This endpoint is public (no authentication required) as it's called by Clerk.
   * Webhook authenticity is verified using Svix signature validation.
   * Handles user lifecycle events: user.created, user.updated, user.deleted.
   *
   * The webhook signature is verified to ensure the request genuinely comes from Clerk.
   * If verification fails or processing throws an error, Clerk will automatically retry.
   * Uses raw body buffer for signature verification (required by Svix library).
   *
   * @param svixId - Unique webhook message ID from Svix headers
   * @param svixTimestamp - Timestamp when the webhook was sent (for replay attack prevention)
   * @param svixSignature - Cryptographic signature to verify webhook authenticity
   * @param req - Request object with raw body buffer for signature verification
   * @returns Success indicator that webhook was received and processed
   * @throws UnauthorizedException if webhook signature verification fails
   * @throws Error if webhook processing fails (triggers Clerk retry)
   *
   * @example
   * POST /webhooks/clerk
   * Headers: { "svix-id": "msg_xxx", "svix-timestamp": "1234567890", "svix-signature": "v1,sig..." }
   * Body: { "type": "user.created", "data": {...} }
   */
  @Public()
  @Post('clerk')
  @HttpCode(HttpStatus.OK)
  async handleClerkWebhook(
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
    @Req() req: RequestWithRawBody
  ): Promise<{ received: boolean }> {
    // Get the raw body
    const payload = req.rawBody?.toString('utf8') || JSON.stringify(req.body);

    // Verify and process the webhook
    // If this throws an error, Clerk will retry the webhook
    await this.webhookService.verifyAndProcess(
      payload,
      svixId,
      svixTimestamp,
      svixSignature
    );

    return { received: true };
  }
}
