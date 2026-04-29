// Queue names
export const QUEUE_NAMES = {
  IMAGE_PROCESSING: 'image-processing',
  POST_PUBLISHING: 'post-publishing',
  NOTIFICATION: 'notification',
} as const;

// Job names
export const JOB_NAMES = {
  PROCESS_POST_IMAGE: 'process-post-image',
  PUBLISH_POST: 'publish-post',
  SEND_PUSH_NOTIFICATION: 'send-push-notification',
} as const;
