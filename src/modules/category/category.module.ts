// Dependencies
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

// Common
import { CacheService } from '@/common/services';

// Controllers
import { CategoryController } from './category.controller';

// Services
import { CategoryService } from './category.service';

// Entities
import { Category } from './category.entity';

@Module({
  imports: [MikroOrmModule.forFeature([Category])],
  controllers: [CategoryController],
  providers: [CategoryService, CacheService],
  exports: [CategoryService],
})
export class CategoryModule {}
