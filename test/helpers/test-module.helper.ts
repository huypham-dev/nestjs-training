/**
 * Test Module Configuration for E2E Tests
 * Bypasses Clerk authentication middleware
 */

// Dependencies
import { DynamicModule } from '@nestjs/common';
import { Test } from '@nestjs/testing';

// Modules
import { AppModule } from '@/app.module';

/**
 * Creates a testing module with mocked middleware
 * This removes Clerk middleware dependency for E2E tests
 */
export async function createTestingModule(): Promise<DynamicModule> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider('APP_FILTER')
    .useValue({}) // Keep filters
    .compile();

  return moduleFixture as any;
}
