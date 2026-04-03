// Dependencies
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';

// Controllers
import { PostController } from './post.controller';

// Services
import { PostService } from './post.service';
import { CacheService } from '@/common/services';
import { StorageService } from '@/shared/services/s3/storage.service';

// Guards
import { PostOwnerGuard, PostOwnerOrAdminGuard } from './post.guards';

// Entities
import { Post } from './post.entity';
import { Category } from '@/modules/category/category.entity';
import { User } from '@/modules/user/user.entity';

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
