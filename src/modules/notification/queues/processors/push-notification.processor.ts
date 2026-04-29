// Dependencies
import { OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Inject, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import type { Job } from 'bull';

// Constants
import { JOB_NAMES, QUEUE_NAMES } from '@/constants';

// Push notification service
import {
  PUSH_NOTIFICATION_SERVICE,
  type IPushNotificationService,
} from '@/shared/services/push-notification/push-notification.interface';

// Entities
import { DeviceToken } from '../../device-token.entity';

// Producer types
import type { PushNotificationJobData } from '../notification.producer';

// FCM error codes that mean the token is permanently invalid
const INVALID_TOKEN_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

@Processor(QUEUE_NAMES.NOTIFICATION)
export class PushNotificationProcessor {
  private readonly logger = new Logger(PushNotificationProcessor.name);

  constructor(
    @Inject(PUSH_NOTIFICATION_SERVICE)
    private readonly pushService: IPushNotificationService,
    private readonly em: EntityManager
  ) {}

  @Process(JOB_NAMES.SEND_PUSH_NOTIFICATION)
  async handleSendPush(job: Job<PushNotificationJobData>): Promise<void> {
    const { userId, tokens, payload } = job.data;
    const attempt = job.attemptsMade + 1;

    this.logger.log(
      `[Attempt ${attempt}] Sending push to user ${userId} (${tokens.length} token(s))`
    );

    const forkedEm = this.em.fork();

    const results = await this.pushService.sendToDevices(tokens, payload);

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    // Deactivate permanently-invalid tokens
    const invalidTokens = results
      .filter((r) => !r.success && INVALID_TOKEN_CODES.has(r.errorCode ?? ''))
      .map((r) => r.token);

    if (invalidTokens.length > 0) {
      await forkedEm.nativeUpdate(
        DeviceToken,
        { token: { $in: invalidTokens } },
        { isActive: false }
      );
      this.logger.warn(
        `Deactivated ${invalidTokens.length} invalid token(s) for user ${userId}`
      );
    }

    this.logger.log(
      `Push for user ${userId}: ${successCount} sent, ${failureCount} failed`
    );

    // Re-throw so Bull retries if every delivery failed
    if (successCount === 0 && tokens.length > 0) {
      throw new Error(
        `All ${tokens.length} push notification(s) failed for user ${userId}`
      );
    }
  }

  @OnQueueFailed()
  onFailed(job: Job<PushNotificationJobData>, error: Error): void {
    this.logger.error(
      `Push notification job ${job.id} failed after ${job.attemptsMade} attempt(s): ${error.message}`
    );
  }
}
