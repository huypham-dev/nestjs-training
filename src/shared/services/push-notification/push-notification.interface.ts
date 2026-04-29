/** DI token – inject this, never the concrete class directly */
export const PUSH_NOTIFICATION_SERVICE = 'PUSH_NOTIFICATION_SERVICE';

export interface PushSendResult {
  /** Device registration token */
  token: string;
  /** True if the provider accepted the message */
  success: boolean;
  /** Provider message ID on success */
  messageId?: string;
  /** Provider error code on failure */
  errorCode?: string;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Arbitrary string key-value pairs forwarded to the client app */
  data?: Record<string, string>;
  /** Optional image URL shown in the notification */
  imageUrl?: string;
}

/**
 * Provider-agnostic push notification abstraction.
 *
 * Concrete implementations:
 *  - FcmService        (Firebase Cloud Messaging) ← current
 *  - OneSignalService  (OneSignal)
 *  - ExpoService       (Expo Push)
 *
 * Swap without touching any business logic – just change the `useClass`
 * in SharedModule and register under PUSH_NOTIFICATION_SERVICE.
 */
export interface IPushNotificationService {
  /**
   * Send a notification to a single device token.
   */
  sendToDevice(token: string, payload: PushPayload): Promise<PushSendResult>;

  /**
   * Send the same notification to multiple tokens.
   * Returns per-token results so callers can handle partial failures.
   */
  sendToDevices(
    tokens: string[],
    payload: PushPayload
  ): Promise<PushSendResult[]>;
}
