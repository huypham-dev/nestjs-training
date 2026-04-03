/**
 * E2E Tests for User API
 */

// Dependencies
import { MikroORM } from '@mikro-orm/core';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

// Modules
import { TestAppModule } from '../support/test-app.module';
import { User } from '@/modules/user/user.entity';

// Interceptors
import { MockAuthInterceptor } from '../support/mock-auth.interceptor';
import { NoOpCacheInterceptor } from '../support/noop-cache.interceptor';

// Constants
import { UserRole, UserStatus } from '@/constants';

// Other
import { TEST_USERS } from '../helpers/auth.helper';
import { createSupertestApp } from '../helpers/test.helper';

describe('User API (e2e)', () => {
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
    const generator = orm.getSchemaGenerator();
    await generator.refreshDatabase();
  });

  afterAll(async () => {
    await orm.close(true);
    await app.close();
  });

  describe('GET /users', () => {
    beforeEach(async () => {
      // Clear and seed test data
      const em = orm.em.fork();

      await em.nativeDelete(User, {});

      // Create test users using entity manager
      const user1 = em.create(User, {
        authId: TEST_USERS.USER1.authId,
        email: TEST_USERS.USER1.email,
        fullName: TEST_USERS.USER1.fullName,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      });

      const user2 = em.create(User, {
        authId: TEST_USERS.USER2.authId,
        email: TEST_USERS.USER2.email,
        fullName: TEST_USERS.USER2.fullName,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      });

      const admin = em.create(User, {
        authId: TEST_USERS.ADMIN.authId,
        email: TEST_USERS.ADMIN.email,
        fullName: TEST_USERS.ADMIN.fullName,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      });

      await em.persist([user1, user2, admin]).flush();
    });

    it('should return all users when authenticated as admin', async () => {
      // Set mock admin user
      MockAuthInterceptor.setMockUser(TEST_USERS.ADMIN);

      const response = await createSupertestApp(app).get('/users').expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveLength(3);
      expect(response.body.data[0]).toHaveProperty('id');
      expect(response.body.data[0]).toHaveProperty('email');
      expect(response.body.data[0]).toHaveProperty('role');
    });

    it('should return 403 when authenticated as regular user', async () => {
      MockAuthInterceptor.setMockUser(TEST_USERS.USER1);

      const response = await createSupertestApp(app).get('/users').expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        code: 'AUTH_FORBIDDEN',
      });
    });
  });

  describe('GET /users/me', () => {
    beforeEach(async () => {
      const em = orm.em.fork();
      await em.nativeDelete(User, {});

      const user = em.create(User, {
        authId: TEST_USERS.USER1.authId,
        email: TEST_USERS.USER1.email,
        fullName: TEST_USERS.USER1.fullName,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      });

      await em.persist(user).flush();
    });

    it('should return current user information', async () => {
      MockAuthInterceptor.setMockUser(TEST_USERS.USER1);

      const response = await createSupertestApp(app)
        .get('/users/me')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toMatchObject({
        email: TEST_USERS.USER1.email,
        fullName: TEST_USERS.USER1.fullName,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      });
    });
  });

  describe('PATCH /users/me', () => {
    beforeEach(async () => {
      const em = orm.em.fork();
      await em.nativeDelete(User, {});

      const user = em.create(User, {
        authId: TEST_USERS.USER1.authId,
        email: TEST_USERS.USER1.email,
        fullName: TEST_USERS.USER1.fullName,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      });

      await em.persist(user).flush();
    });

    it('should update current user full name', async () => {
      MockAuthInterceptor.setMockUser(TEST_USERS.USER1);

      const updateData = {
        fullName: 'Updated Full Name',
      };

      const response = await createSupertestApp(app)
        .patch('/users/me')
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toMatchObject({
        email: TEST_USERS.USER1.email,
        fullName: 'Updated Full Name',
      });
    });

    it('should return 400 for invalid data', async () => {
      MockAuthInterceptor.setMockUser(TEST_USERS.USER1);

      const response = await createSupertestApp(app)
        .patch('/users/me')
        .send({ fullName: '' }) // Empty string should fail validation
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
      });
    });
  });

  describe('PATCH /users/:id/status', () => {
    let userId: string;

    beforeEach(async () => {
      const em = orm.em.fork();
      await em.nativeDelete(User, {});

      const admin = em.create(User, {
        authId: TEST_USERS.ADMIN.authId,
        email: TEST_USERS.ADMIN.email,
        fullName: TEST_USERS.ADMIN.fullName,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      });

      const user = em.create(User, {
        authId: TEST_USERS.USER1.authId,
        email: TEST_USERS.USER1.email,
        fullName: TEST_USERS.USER1.fullName,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      });

      await em.persist([admin, user]).flush();
      userId = user.id;
    });

    it('should update user status when authenticated as admin', async () => {
      MockAuthInterceptor.setMockUser(TEST_USERS.ADMIN);

      const response = await createSupertestApp(app)
        .patch(`/users/${userId}/status`)
        .send({ status: UserStatus.INACTIVE })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toMatchObject({
        id: userId,
        status: UserStatus.INACTIVE,
      });
    });

    it('should return 403 when regular user tries to update status', async () => {
      MockAuthInterceptor.setMockUser(TEST_USERS.USER1);

      const response = await createSupertestApp(app)
        .patch(`/users/${userId}/status`)
        .send({ status: UserStatus.INACTIVE })
        .expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        code: 'AUTH_FORBIDDEN',
      });
    });

    it('should return 404 for non-existent user', async () => {
      MockAuthInterceptor.setMockUser(TEST_USERS.ADMIN);

      // Use a valid UUID format but non-existent ID
      const fakeUuid = '00000000-0000-4000-8000-000000000000';
      const response = await createSupertestApp(app)
        .patch(`/users/${fakeUuid}/status`)
        .send({ status: UserStatus.INACTIVE })
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
      });
    });
  });
});
