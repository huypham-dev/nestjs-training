export const SocketEvents = {
  USER_STATUS_CHANGED: 'user:status_changed',
} as const;

export const SocketRooms = {
  ADMINS: 'admins',
  USER_AUTH: (authId: string) => `auth:${authId}`,
} as const;
