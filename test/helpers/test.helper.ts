/**
 * Test helpers for E2E tests
 */

// Dependencies
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';

/**
 * API version prefix for tests
 */
const API_VERSION = 'v1';

/**
 * Add version prefix to API path
 * @param path - API path without version (e.g., '/users')
 * @returns Path with version (e.g., '/v1/users')
 */
export function versionedPath(path: string): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `/${API_VERSION}/${cleanPath}`;
}

/**
 * Setup versioning for test app
 * @param app - NestJS application instance
 */
export function setupVersioning(app: INestApplication): void {
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: API_VERSION,
  });
}

/**
 * Create supertest instance from NestJS app
 * Suppresses TypeScript warnings about app.getHttpServer() type
 */
export function createSupertestApp(app: INestApplication) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  return request(app.getHttpServer());
}
