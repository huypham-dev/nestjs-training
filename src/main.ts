// Dependencies
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from '@asteasolutions/zod-to-openapi';

// Modules
import { AppModule } from './app.module';

// Interceptors
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';

// Import Zod schemas to register them
import {
  userSchema,
  updateCurrentUserSchema,
  updateUserStatusSchema,
} from './modules/user/user.dto';
import {
  postSchema,
  createPostSchema,
  updatePostSchema,
} from './modules/post/post.dto';
import { categorySchema } from './modules/category/category.dto';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enables CORS with default settings
  app.enableCors();

  // Use Helmet to enhance API security
  app.use(helmet());

  // Set global prefix with versioning from environment variables (e.g., /api/v1)
  const apiBasePath = process.env.API_BASE_PATH || 'api';
  const apiVersion = process.env.API_VERSION || '1';
  const globalPrefix = `${apiBasePath}/v${apiVersion}`;

  app.setGlobalPrefix(globalPrefix);

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
      'clerk-auth'
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

  SwaggerModule.setup(`${globalPrefix}/docs`, app, document, {
    customSiteTitle: 'Blog API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
  });

  const port = process.env.PORT ?? 8000;
  await app.listen(port);

  console.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
  console.log(
    `📚 Swagger documentation: http://localhost:${port}/${globalPrefix}/docs`
  );
}

void bootstrap();
