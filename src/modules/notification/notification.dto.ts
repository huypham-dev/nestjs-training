// Dependencies
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Constants
import { DevicePlatform } from '@/constants';

// Extend Zod with OpenAPI
extendZodWithOpenApi(z);

export const registerDeviceSchema = z
  .object({
    token: z.string().min(1, 'FCM token is required').openapi({
      description: 'Firebase Cloud Messaging registration token',
      example: 'fGrTx9z...',
    }),
    platform: z.nativeEnum(DevicePlatform).optional().openapi({
      description: 'Client platform',
      example: DevicePlatform.ANDROID,
    }),
    deviceName: z.string().max(100).optional().openapi({
      description: 'Human-readable device label',
      example: 'iPhone 15 Pro',
    }),
  })
  .openapi({ description: 'Register a device FCM token' });

export const unregisterDeviceSchema = z
  .object({
    token: z.string().min(1, 'FCM token is required').openapi({
      description: 'Firebase Cloud Messaging registration token to remove',
      example: 'fGrTx9z...',
    }),
  })
  .openapi({ description: 'Unregister a device FCM token' });

export const sendNotificationToUserSchema = z
  .object({
    userId: z.uuid('Invalid user ID').openapi({
      description: 'Target user UUID',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    title: z.string().min(1, 'Title is required').max(200).openapi({
      description: 'Notification title',
      example: 'Your post was published',
    }),
    body: z.string().min(1, 'Body is required').openapi({
      description: 'Notification body text',
      example: 'Your scheduled post "Getting started with NestJS" is now live.',
    }),
    data: z
      .record(z.string(), z.string())
      .optional()
      .openapi({
        description:
          'Arbitrary key-value data payload forwarded to the client app',
        example: { postId: '123', type: 'POST_PUBLISHED' },
      }),
    imageUrl: z.url('Invalid image URL').optional().openapi({
      description: 'Optional image URL shown in the notification',
      example: 'https://cdn.example.com/post-cover.jpg',
    }),
  })
  .openapi({ description: 'Send a push notification to a user' });

export type RegisterDeviceDto = z.infer<typeof registerDeviceSchema>;
export type UnregisterDeviceDto = z.infer<typeof unregisterDeviceSchema>;
export type SendNotificationToUserDto = z.infer<
  typeof sendNotificationToUserSchema
>;
