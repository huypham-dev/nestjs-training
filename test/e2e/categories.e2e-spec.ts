/**
 * E2E Tests for Category API
 */

// Dependencies
import { MikroORM } from '@mikro-orm/core';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

// Modules
import { TestAppModule } from '../support/test-app.module';
import { Category } from '@/modules/category/category.entity';
import { User } from '@/modules/user/user.entity';

// Interceptors
import { MockAuthInterceptor } from '../support/mock-auth.interceptor';
import { NoOpCacheInterceptor } from '../support/noop-cache.interceptor';

// Constants
import { UserRole, UserStatus } from '@/constants';

// Other
import { TEST_USERS } from '../helpers/auth.helper';
import { createSupertestApp } from '../helpers/test.helper';

describe('Category API (e2e)', () => {
  let app: INestApplication;
  let orm: MikroORM;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    })
      .overrideInterceptor(CacheInterceptor)
      .useClass(NoOpCacheInterceptor)
      .compile();

    app = moduleFixture.createNestApplication();
    orm = moduleFixture.get(MikroORM);

    await app.init();

    // Reset database before tests
    const generator = orm.schema;
    await generator.refreshDatabase();
  });

  afterAll(async () => {
    await orm.close(true);
    await app.close();
  });

  describe('GET /categories', () => {
    beforeEach(async () => {
      const em = orm.em.fork();

      // Clear existing data
      await em.nativeDelete(Category, {});
      await em.nativeDelete(User, {});

      // Create test user
      const user = em.create(User, {
        authId: TEST_USERS.USER1.authId,
        email: TEST_USERS.USER1.email,
        fullName: TEST_USERS.USER1.fullName,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      });

      // Create test categories
      const category1 = em.create(Category, {
        name: 'Technology',
      });

      const category2 = em.create(Category, {
        name: 'Sports',
      });

      const category3 = em.create(Category, {
        name: 'Business',
      });

      await em.persist([user, category1, category2, category3]).flush();
    });

    it('should return all categories sorted by name', async () => {
      MockAuthInterceptor.setMockUser(TEST_USERS.USER1);

      const response = await createSupertestApp(app)
        .get('/categories')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveLength(3);

      // Verify sorting by name
      expect(response.body.data[0].name).toBe('Business');
      expect(response.body.data[1].name).toBe('Sports');
      expect(response.body.data[2].name).toBe('Technology');

      // Verify structure
      expect(response.body.data[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
      });
    });

    it('should return empty array when no categories exist', async () => {
      // Clear all categories
      const em = orm.em.fork();
      await em.nativeDelete(Category, {});

      MockAuthInterceptor.setMockUser(TEST_USERS.USER1);

      const response = await createSupertestApp(app)
        .get('/categories')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toEqual([]);
    });

    it('should work for both regular users and admins', async () => {
      // Test with regular user
      MockAuthInterceptor.setMockUser(TEST_USERS.USER1);

      const userResponse = await createSupertestApp(app)
        .get('/categories')
        .expect(200);

      expect(userResponse.body.data).toHaveLength(3);

      // Test with admin
      MockAuthInterceptor.setMockUser(TEST_USERS.ADMIN);

      const adminResponse = await createSupertestApp(app)
        .get('/categories')
        .expect(200);

      expect(adminResponse.body.data).toHaveLength(3);
    });
  });
});
