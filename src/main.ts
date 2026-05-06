// Dependencies
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from '@asteasolutions/zod-to-openapi';
import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import type { Request, Response } from 'express';
import helmet from 'helmet';

// Modules
import { AppModule } from './app.module';
import { categorySchema } from './modules/category/category.dto';
import {
  postSchema,
  createPostSchema,
  updatePostSchema,
} from './modules/post/post.dto';
import {
  userSchema,
  updateCurrentUserSchema,
  updateUserStatusSchema,
} from './modules/user/user.dto';

// Interceptors
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';

// Cached NestJS app instance (for Vercel serverless reuse)
let cachedApp: NestExpressApplication | null = null;

async function createApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: true,
    rawBody: true,
  });

  // Increase body size limit for file uploads (10MB)
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));

  // Enables CORS with default settings
  app.enableCors();

  // Use Helmet to enhance API security
  app.use(helmet());

  // Set global prefix (e.g., /api)
  const apiBasePath = process.env.API_BASE_PATH || 'api';
  app.setGlobalPrefix(apiBasePath);

  // Enable URI Versioning (e.g., /api/v1/users, /api/v2/users)
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1', // Default version if not specified
  });

  // Apply global response interceptor (optional - for standardizing success responses)
  app.useGlobalInterceptors(new ResponseTransformInterceptor());

  // Setup Swagger/OpenAPI Documentation
  const config = new DocumentBuilder()
    .setTitle('Blog API')
    .setDescription(
      'RESTful API for Blog Management System with posts, categories, and users. ' +
        'Features authentication via Clerk, role-based access control, and post visibility rules.'
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your Clerk JWT token',
        in: 'header',
      },
      'Auth'
    )
    .addTag('Users', 'User management endpoints')
    .addTag('Posts', 'Blog post management endpoints')
    .addTag('Categories', 'Category management endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Register Zod schemas with OpenAPI Registry
  const registry = new OpenAPIRegistry();
  registry.register('UserResponse', userSchema);
  registry.register('UpdateCurrentUserRequest', updateCurrentUserSchema);
  registry.register('UpdateUserStatusRequest', updateUserStatusSchema);
  registry.register('PostResponse', postSchema);
  registry.register('CreatePostRequest', createPostSchema);
  registry.register('UpdatePostRequest', updatePostSchema);
  registry.register('CategoryResponse', categorySchema);

  // Generate OpenAPI schemas from Zod schemas
  const generator = new OpenApiGeneratorV3(registry.definitions);
  const zodSchemas = generator.generateComponents().components?.schemas || {};

  // Merge Zod schemas into the NestJS Swagger document
  if (!document.components) {
    document.components = {};
  }
  document.components.schemas = {
    ...document.components.schemas,
    ...(zodSchemas as any),
  };

  SwaggerModule.setup(`${apiBasePath}/docs`, app, document, {
    customSiteTitle: 'Blog API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
  });

  await app.init();

  return app;
}

// Vercel serverless handler
export default async function handler(req: Request, res: Response) {
  if (!cachedApp) {
    cachedApp = await createApp();
  }

  const expressApp = cachedApp.getHttpAdapter().getInstance();
  return expressApp(req, res);
}

// Local development bootstrap
async function bootstrap() {
  const app = await createApp();

  const apiBasePath = process.env.API_BASE_PATH || 'api';
  const port = process.env.PORT ?? 8000;
  await app.listen(port);

  console.log(
    `🚀 Application is running on: http://localhost:${port}/${apiBasePath}`
  );
  console.log(
    `📚 Swagger documentation: http://localhost:${port}/${apiBasePath}/docs`
  );
  console.log(`📌 API Versioning: URI-based (e.g., /${apiBasePath}/v1/users)`);
}

// Only run bootstrap when not in Vercel serverless environment
if (process.env.VERCEL !== '1') {
  void bootstrap();
}
