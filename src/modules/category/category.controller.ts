// Dependencies
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiSecurity } from '@nestjs/swagger';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';

// Common decorators
import { ApiDocumentation } from '@/common/decorators';

// Constants
import { CACHE_KEYS } from '@/constants';

// Services
import { CategoryService } from './category.service';
import { Category } from './category.entity';
import { CategoryResponse } from './category.dto';

@ApiTags('Categories')
@ApiSecurity('clerk-auth')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(CacheInterceptor)
  @CacheKey(CACHE_KEYS.CATEGORIES_LIST)
  @CacheTTL(300000) // 5 minutes - categories change less frequently
  @ApiDocumentation({
    operation: {
      summary: 'Get all categories',
      description: 'Retrieve a list of all available categories in the system.',
    },
    response: {
      status: 200,
      description: 'Successfully retrieved categories list',
      schema: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/CategoryResponse' },
          },
        },
      },
    },
  })
  async getAllCategories() {
    const data = await this.categoryService.getAllCategories();

    return {
      data: data.map((category) => this.toCategoryResponse(category)),
    };
  }

  private toCategoryResponse(category: Category): CategoryResponse {
    return {
      id: category.id,
      name: category.name,
      createdAt: category.createdAt.toISOString(),
    };
  }
}
