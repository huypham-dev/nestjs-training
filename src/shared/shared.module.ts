// Dependencies
import { Global, Module } from '@nestjs/common';

// Services
import { ClerkService } from './services/clerk/clerk.service';
import { StorageService } from './services/storage/s3.service';

const providers = [StorageService, ClerkService];

@Global()
@Module({
  providers: [...providers],
  exports: [...providers],
})
export class SharedModule {}
