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

// Guards
import { PostOwnerGuard, PostOwnerOrAdminGuard } from './post.guards';

// Entities
import { Post } from './post.entity';

@Module({
  imports: [MikroOrmModule.forFeature([Post, Category, User])],
  controllers: [PostController],
  providers: [PostService, PostOwnerGuard, PostOwnerOrAdminGuard, CacheService],
  exports: [PostService],
})
export class PostModule {}
