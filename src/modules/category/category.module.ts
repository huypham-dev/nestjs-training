// Dependencies
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';

// Controllers
import { CategoryController } from './category.controller';

// Services
import { CategoryService } from './category.service';
import { CacheService } from '@/common/services';

// Entities
import { Category } from './category.entity';

@Module({
  imports: [MikroOrmModule.forFeature([Category])],
  controllers: [CategoryController],
  providers: [CategoryService, CacheService],
  exports: [CategoryService],
})
export class CategoryModule {}
