// Dependencies
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

// Interface
import type {
  IPushNotificationService,
  PushPayload,
  PushSendResult,
} from './push-notification.interface';

/**
 * Firebase Cloud Messaging – concrete implementation of IPushNotificationService.
 *
 * Registered under the PUSH_NOTIFICATION_SERVICE token in SharedModule.
 * To swap: implement IPushNotificationService, change `useClass` in SharedModule.
 */
@Injectable()
export class PushNotificationService
  implements IPushNotificationService, OnModuleInit
{
  private readonly logger = new Logger(PushNotificationService.name);
  private messaging!: admin.messaging.Messaging;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    // Avoid re-initialising if another module already called initializeApp()
    if (!admin.apps.length) {
      const serviceAccountJson = this.configService.get<string>(
        'FIREBASE_SERVICE_ACCOUNT_JSON'
      );

      if (!serviceAccountJson) {
        this.logger.warn(
          'FIREBASE_SERVICE_ACCOUNT_JSON is not set. FCM will not send real notifications.'
        );
        return;
      }

      let serviceAccount: admin.ServiceAccount;
      try {
        serviceAccount = JSON.parse(serviceAccountJson) as admin.ServiceAccount;
      } catch {
        this.logger.warn(
          'FIREBASE_SERVICE_ACCOUNT_JSON is invalid JSON. FCM will not send real notifications.'
        );
        return;
      }
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      this.logger.log('Firebase Admin SDK initialised.');
    }

    this.messaging = admin.messaging();
  }

  // Sends a notification to a single device token by delegating to sendToDevices.
  async sendToDevice(
    token: string,
    payload: PushPayload
  ): Promise<PushSendResult> {
    const results = await this.sendToDevices([token], payload);
    return results[0];
  }

  // Sends the same notification to multiple tokens
  async sendToDevices(
    tokens: string[],
    payload: PushPayload
  ): Promise<PushSendResult[]> {
    if (!this.messaging) {
      this.logger.warn('Firebase messaging not initialised – skipping send.');
      return tokens.map((token) => ({
        token,
        success: false,
        errorCode: 'NOT_INITIALISED',
      }));
    }

    if (tokens.length === 0) return [];

    // FCM multicast supports up to 500 tokens per call
    const chunks = this.chunkArray(tokens, 500);
    const allResults: PushSendResult[] = [];

    for (const chunk of chunks) {
      const message: admin.messaging.MulticastMessage = {
        tokens: chunk,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: payload.data,
        android: {
          priority: 'high',
          notification: { sound: 'default' },
        },
        apns: {
          payload: {
            aps: { sound: 'default', badge: 1 },
          },
        },
      };

      try {
        const response = await this.messaging.sendEachForMulticast(message);

        response.responses.forEach((resp, idx) => {
          allResults.push({
            token: chunk[idx],
            success: resp.success,
            messageId: resp.messageId,
            errorCode: resp.error?.code,
          });
        });
      } catch (error) {
        // Catastrophic failure for the whole chunk
        this.logger.error(`FCM multicast failed: ${error.message}`);
        chunk.forEach((token) =>
          allResults.push({
            token,
            success: false,
            errorCode: 'MULTICAST_FAILED',
          })
        );
      }
    }

    return allResults;
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
