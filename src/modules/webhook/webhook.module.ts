// Dependencies
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Modules
import { UserModule } from '../user/user.module';

// Controllers
import { WebhookController } from './webhook.controller';

// Services
import { WebhookService } from './webhook.service';

@Module({
  imports: [ConfigModule, UserModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
