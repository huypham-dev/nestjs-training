import { Global, Module } from '@nestjs/common';
import { StorageService } from './services/s3/storage.service';
import { ClerkService } from './services/clerk/clerk.service';

const providers = [StorageService, ClerkService];

@Global()
@Module({
  providers: [...providers],
  exports: [...providers],
})
export class SharedModule {}
