/**
 * E2E Tests for Post API
 */

// Dependencies
import { MikroORM } from '@mikro-orm/core';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

// Modules
import { TestAppModule } from '../support/test-app.module';
import { Category } from '@/modules/category/category.entity';
import { PostCategory } from '@/modules/post/post-category.entity';
import { Post } from '@/modules/post/post.entity';
import { User } from '@/modules/user/user.entity';

// Interceptors
import { MockAuthInterceptor } from '../support/mock-auth.interceptor';
import { NoOpCacheInterceptor } from '../support/noop-cache.interceptor';

// Constants
import { UserRole, UserStatus, PostStatus } from '@/constants';

// Other
import { TEST_USERS } from '../helpers/auth.helper';
import { createSupertestApp } from '../helpers/test.helper';

describe('Post API (e2e)', () => {
  let app: INestApplication;
  let orm: MikroORM;
  let user1: User;
  let user2: User;
  let admin: User;
  let category1: Category;
  let category2: Category;

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

  beforeEach(async () => {
    const em = orm.em.fork();

    // Clear existing data (order matters due to FK constraints!)
    await em.nativeDelete(PostCategory, {}); // Delete junction table first
    await em.nativeDelete(Post, {});
    await em.nativeDelete(Category, {});
    await em.nativeDelete(User, {});

    // Create test users
    user1 = em.create(User, {
      authId: TEST_USERS.USER1.authId,
      email: TEST_USERS.USER1.email,
      fullName: TEST_USERS.USER1.fullName,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    });

    user2 = em.create(User, {
      authId: TEST_USERS.USER2.authId,
      email: TEST_USERS.USER2.email,
      fullName: TEST_USERS.USER2.fullName,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    });

    admin = em.create(User, {
      authId: TEST_USERS.ADMIN.authId,
      email: TEST_USERS.ADMIN.email,
      fullName: TEST_USERS.ADMIN.fullName,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });

    // Create test categories
    category1 = em.create(Category, {
      name: 'Technology',
    });

    category2 = em.create(Category, {
      name: 'Business',
    });

    await em.persist([user1, user2, admin, category1, category2]).flush();
  });

  describe('POST /posts', () => {
    it('should create a new post with categories', async () => {
      MockAuthInterceptor.setMockUser(TEST_USERS.USER1);

      const postData = {
        title: 'Test Post',
        content: 'This is a test post content',
        categoryIds: [category1.id, category2.id],
      };

      const response = await createSupertestApp(app)
        .post('/posts')
        .send(postData)
        .expect(201);

      expect(response.body).toMatchObject({
        data: {
          title: 'Test Post',
          content: 'This is a test post content',
          status: PostStatus.DRAFT,
          author: {
            id: user1.id,
            email: TEST_USERS.USER1.email,
            fullName: TEST_USERS.USER1.fullName,
          },
          categories: expect.arrayContaining([
            expect.objectContaining({
              id: category1.id,
              name: expect.any(String),
            }),
            expect.objectContaining({
              id: category2.id,
              name: expect.any(String),
            }),
          ]),
        },
      });
    });

    it('should return 400 for invalid post data', async () => {
      MockAuthInterceptor.setMockUser(TEST_USERS.USER1);

      const response = await createSupertestApp(app)
        .post('/posts')
        .send({ title: '' }) // Missing required fields
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
      });
    });
  });

  describe('GET /posts', () => {
    beforeEach(async () => {
      const em = orm.em.fork();

      // Create published post by user1
      const publishedPost = em.create(Post, {
        title: 'Published Post',
        content: 'Published content',
        status: PostStatus.PUBLISHED,
        user: user1.id, // Use ID instead of entity reference
      });

      // Create draft post by user1
      const draftPost = em.create(Post, {
        title: 'Draft Post',
        content: 'Draft content',
        status: PostStatus.DRAFT,
        user: user1.id, // Use ID instead of entity reference
      });

      // Create published post by user2
      const user2Post = em.create(Post, {
        title: 'User 2 Post',
        content: 'User 2 content',
        status: PostStatus.PUBLISHED,
        user: user2.id, // Use ID instead of entity reference
      });

      await em.persist([publishedPost, draftPost, user2Post]).flush();
    });

    it('should return only published posts for regular users', async () => {
      MockAuthInterceptor.setMockUser(TEST_USERS.USER1);

      const response = await createSupertestApp(app).get('/posts').expect(200);

      expect(response.body).toMatchObject({});

      // Should only see published posts (2 posts)
      expect(response.body.data).toHaveLength(2);
      expect(
        response.body.data.every(
          (post: any) => post.status === PostStatus.PUBLISHED
        )
      ).toBe(true);
    });

    it('should return all posts for admin users', async () => {
      MockAuthInterceptor.setMockUser(TEST_USERS.ADMIN);

      const response = await createSupertestApp(app).get('/posts').expect(200);

      // Admin should see all posts (3 posts)
      expect(response.body.data).toHaveLength(3);
    });
  });

  describe('GET /posts/:id', () => {
    let publishedPostId: string;
    let draftPostId: string;

    beforeEach(async () => {
      const em = orm.em.fork();

      // Create published post
      const publishedPost = em.create(Post, {
        title: 'Published Post',
        content: 'Published content',
        status: PostStatus.PUBLISHED,
        user: user1.id, // Use ID instead of entity reference
      });

      // Create draft post
      const draftPost = em.create(Post, {
        title: 'Draft Post',
        content: 'Draft content',
        status: PostStatus.DRAFT,
        user: user1.id, // Use ID instead of entity reference
      });

      await em.persist([publishedPost, draftPost]).flush();

      publishedPostId = publishedPost.id;
      draftPostId = draftPost.id;
    });

    it('should allow anyone to view published posts', async () => {
      MockAuthInterceptor.setMockUser(TEST_USERS.USER2);

      const response = await createSupertestApp(app)
        .get(`/posts/${publishedPostId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          id: publishedPostId,
          title: 'Published Post',
          status: PostStatus.PUBLISHED,
        },
      });
    });

    it('should allow owner to view their draft posts', async () => {
      MockAuthInterceptor.setMockUser(TEST_USERS.USER1);

      const response = await createSupertestApp(app)
        .get(`/posts/${draftPostId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          id: draftPostId,
          title: 'Draft Post',
          status: PostStatus.DRAFT,
        },
      });
    });

    it('should deny access to draft posts for non-owners', async () => {
      MockAuthInterceptor.setMockUser(TEST_USERS.USER2);

      const response = await createSupertestApp(app)
        .get(`/posts/${draftPostId}`)
        .expect(403);

      expect(response.body).toMatchObject({
        code: 'AUTH_FORBIDDEN',
      });
    });

    it('should allow admins to view any post', async () => {
      MockAuthInterceptor.setMockUser(TEST_USERS.ADMIN);

      const response = await createSupertestApp(app)
        .get(`/posts/${draftPostId}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: draftPostId,
        status: PostStatus.DRAFT,
      });
    });

    it('should return 404 for non-existent post', async () => {
      MockAuthInterceptor.setMockUser(TEST_USERS.USER1);

      const fakeUuid = '00000000-0000-4000-8000-000000000000';
      const response = await createSupertestApp(app)
        .get(`/posts/${fakeUuid}`)
        .expect(404);

      expect(response.body).toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
      });
    });
  });

  describe('PATCH /posts/:id', () => {
    let postId: string;

    beforeEach(async () => {
      const em = orm.em.fork();

      const post = em.create(Post, {
        title: 'Original Title',
        content: 'Original content',
        status: PostStatus.DRAFT,
        user: user1.id, // Use ID instead of entity reference
      });

      await em.persist(post).flush();
      postId = post.id;
    });

    it('should allow owner to update their post', async () => {
      MockAuthInterceptor.setMockUser(TEST_USERS.USER1);

      const updateData = {
        title: 'Updated Title',
        content: 'Updated content',
        status: PostStatus.PUBLISHED,
      };

      const response = await createSupertestApp(app)
        .patch(`/posts/${postId}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          id: postId,
          title: 'Updated Title',
          content: 'Updated content',
          status: PostStatus.PUBLISHED,
        },
      });
    });

    it('should deny non-owner from updating post', async () => {
      MockAuthInterceptor.setMockUser(TEST_USERS.USER2);

      const response = await createSupertestApp(app)
        .patch(`/posts/${postId}`)
        .send({ title: 'Hacked Title' })
        .expect(403);

      expect(response.body).toMatchObject({
        code: 'AUTH_FORBIDDEN',
      });
    });

    it('should allow admin to update any post', async () => {
      MockAuthInterceptor.setMockUser(TEST_USERS.ADMIN);

      const response = await createSupertestApp(app)
        .patch(`/posts/${postId}`)
        .send({ title: 'Admin Updated Title' })
        .expect(200);

      expect(response.body.data).toMatchObject({
        title: 'Admin Updated Title',
      });
    });
  });

  describe('DELETE /posts/:id', () => {
    let postId: string;

    beforeEach(async () => {
      const em = orm.em.fork();

      // Find user1 in the forked EM context
      const testUser = await em.findOneOrFail(User, {
        authId: TEST_USERS.USER1.authId,
      });

      const post = em.create(Post, {
        title: 'Post to Delete',
        content: 'Content to delete',
        status: PostStatus.DRAFT,
        user: testUser,
      });

      await em.persist(post).flush();
      postId = post.id;
    });

    it('should allow owner to delete their post', async () => {
      MockAuthInterceptor.setMockUser(TEST_USERS.USER1);

      await createSupertestApp(app).delete(`/posts/${postId}`).expect(204);
    });

    it('should deny non-owner from deleting post', async () => {
      MockAuthInterceptor.setMockUser(TEST_USERS.USER2);

      const response = await createSupertestApp(app)
        .delete(`/posts/${postId}`)
        .expect(403);

      expect(response.body).toMatchObject({
        code: 'AUTH_FORBIDDEN',
      });
    });

    it('should allow admin to delete any post', async () => {
      MockAuthInterceptor.setMockUser(TEST_USERS.ADMIN);

      await createSupertestApp(app).delete(`/posts/${postId}`).expect(204);
    });
  });

  describe('GET /users/:id/posts', () => {
    beforeEach(async () => {
      const em = orm.em.fork();

      // Create multiple posts for user1
      const published1 = em.create(Post, {
        title: 'Published Post 1',
        content: 'Content 1',
        status: PostStatus.PUBLISHED,
        user: user1.id, // Use ID instead of entity reference
      });

      const published2 = em.create(Post, {
        title: 'Published Post 2',
        content: 'Content 2',
        status: PostStatus.PUBLISHED,
        user: user1.id, // Use ID instead of entity reference
      });

      const draft = em.create(Post, {
        title: 'Draft Post',
        content: 'Draft content',
        status: PostStatus.DRAFT,
        user: user1.id, // Use ID instead of entity reference
      });

      await em.persist([published1, published2, draft]).flush();
    });

    it('should return only published posts for non-owner viewing', async () => {
      MockAuthInterceptor.setMockUser(TEST_USERS.USER2);

      const response = await createSupertestApp(app)
        .get(`/users/${user1.id}/posts`)
        .expect(200);

      expect(response.body).toMatchObject({});

      // Should only see published posts (2 posts)
      expect(response.body.data).toHaveLength(2);
      expect(
        response.body.data.every(
          (post: any) => post.status === PostStatus.PUBLISHED
        )
      ).toBe(true);
    });

    it('should return all posts for post owner', async () => {
      MockAuthInterceptor.setMockUser(TEST_USERS.USER1);

      const response = await createSupertestApp(app)
        .get(`/users/${user1.id}/posts`)
        .expect(200);

      // Owner should see all their posts (3 posts)
      expect(response.body.data).toHaveLength(3);
    });

    it('should return all posts for admin', async () => {
      MockAuthInterceptor.setMockUser(TEST_USERS.ADMIN);

      const response = await createSupertestApp(app)
        .get(`/users/${user1.id}/posts`)
        .expect(200);

      // Admin should see all posts (3 posts)
      expect(response.body.data).toHaveLength(3);
    });

    it('should return 404 for non-existent user', async () => {
      MockAuthInterceptor.setMockUser(TEST_USERS.USER1);

      const fakeUuid = '00000000-0000-4000-8000-000000000000';
      const response = await createSupertestApp(app)
        .get(`/users/${fakeUuid}/posts`)
        .expect(404);

      expect(response.body).toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
      });
    });
  });
});
