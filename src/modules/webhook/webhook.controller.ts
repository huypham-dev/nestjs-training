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
