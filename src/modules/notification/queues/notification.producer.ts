// Dependencies
import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bull';

// Constants
import { JOB_NAMES, QUEUE_NAMES } from '@/constants';

// FCM interface
import type { PushPayload } from '@/shared/services/push-notification/push-notification.interface';

export interface PushNotificationJobData {
  /** Target user ID (used for logging) */
  userId: string;
  /** Pre-resolved device tokens to deliver to */
  tokens: string[];
  payload: PushPayload;
}

/**
 * Enqueues push notification jobs into the Bull notification queue.
 * Keeps the request lifecycle non-blocking.
 */
@Injectable()
export class NotificationProducer {
  private readonly logger = new Logger(NotificationProducer.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.NOTIFICATION)
    private readonly notificationQueue: Queue
  ) {}

  async enqueuePushNotification(data: PushNotificationJobData): Promise<void> {
    await this.notificationQueue.add(JOB_NAMES.SEND_PUSH_NOTIFICATION, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: false, // retain failed jobs for inspection
    });

    this.logger.log(
      `Enqueued push notification for user ${data.userId} → ${data.tokens.length} device(s)`
    );
  }
}
