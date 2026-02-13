// Dependencies
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';

// Controllers
import { PostController } from './post.controller';

// Services
import { PostService } from './post.service';

// Guards
import { PostOwnerOrAdminGuard } from './post.guards';

// Entities
import { Post } from './post.entity';
import { Category } from '@/modules/category/category.entity';

@Module({
  imports: [MikroOrmModule.forFeature([Post, Category])],
  controllers: [PostController],
  providers: [PostService, PostOwnerOrAdminGuard],
  exports: [PostService],
})
export class PostModule {}
