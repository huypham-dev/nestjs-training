// Dependencies
import { NestFactory } from '@nestjs/core';

// Modules
import { AppModule } from './app.module';

// Interceptors
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global prefix with versioning from environment variables (e.g., /api/v1)
  app.setGlobalPrefix(
    `${process.env.API_BASE_PATH}/v${process.env.API_VERSION ?? '1'}`
  );

  // Apply global response interceptor (optional - for standardizing success responses)
  app.useGlobalInterceptors(new ResponseTransformInterceptor());

  await app.listen(process.env.PORT ?? 8000);
}
void bootstrap();
