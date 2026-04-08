// Dependencies
import { Controller, Get, HttpCode, HttpStatus, Version } from '@nestjs/common';
import { ApiTags, ApiSecurity } from '@nestjs/swagger';

// Common
import { ApiDocumentation } from '@/common/decorators';

// Services
import { CategoryService } from './category.service';

// Entities
import { Category } from './category.entity';

// DTOs
import { CategoryResponse } from './category.dto';

@ApiTags('Categories')
@ApiSecurity('Auth')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Version('1')
  @Get()
  @HttpCode(HttpStatus.OK)
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
