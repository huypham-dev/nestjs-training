// Dependencies
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';

// Controllers
import { PostController } from './post.controller';

// Services
import { PostService } from './post.service';
import { CacheService } from '@/common/services';

// Guards
import { PostOwnerOrAdminGuard } from './post.guards';

// Entities
import { Post } from './post.entity';
import { Category } from '@/modules/category/category.entity';
import { User } from '@/modules/user/user.entity';

@Module({
  imports: [MikroOrmModule.forFeature([Post, Category, User])],
  controllers: [PostController],
  providers: [PostService, PostOwnerOrAdminGuard, CacheService],
  exports: [PostService],
})
export class PostModule {}
