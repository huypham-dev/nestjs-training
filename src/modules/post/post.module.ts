// Dependencies
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

// Common
import { CacheService } from '@/common/services';

// Modules
import { Category } from '@/modules/category/category.entity';
import { User } from '@/modules/user/user.entity';

// Controllers
import { PostController } from './post.controller';

// Services
import { PostService } from './post.service';
import { StorageService } from '@/shared/services/storage/s3.service';

// Guards
import { PostOwnerGuard, PostOwnerOrAdminGuard } from './post.guards';

// Entities
import { Post } from './post.entity';

@Module({
  imports: [MikroOrmModule.forFeature([Post, Category, User])],
  controllers: [PostController],
  providers: [
    PostService,
    PostOwnerGuard,
    PostOwnerOrAdminGuard,
    CacheService,
    StorageService,
  ],
  exports: [PostService],
})
export class PostModule {}
