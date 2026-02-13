/**
 * Test helpers for E2E tests
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';

/**
 * Create supertest instance from NestJS app
 * Suppresses TypeScript warnings about app.getHttpServer() type
 */
export function createSupertestApp(app: INestApplication) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  return request(app.getHttpServer());
}
