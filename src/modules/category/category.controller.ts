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

  /**
   * Get all categories
   *
   * Retrieves a complete list of all available categories in the system.
   * Categories are used to organize and classify blog posts.
   * This endpoint is accessible to all authenticated users.
   * No pagination is applied as the category list is typically small.
   *
   * @returns List of all categories with ID, name, and creation timestamp
   *
   * @example
   * GET /categories
   * Response: { "data": [{ "id": "uuid", "name": "Technology", "createdAt": "2024-01-01T00:00:00.000Z" }] }
   */
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

  /**
   * Convert category entity to response DTO
   *
   * Helper method to transform a category entity into the API response format.
   * Extracts and formats all necessary fields for the CategoryResponse DTO.
   * Ensures consistent response structure across all category endpoints.
   *
   * @param category - Category entity from database
   * @returns Formatted category response DTO with ID, name, and ISO timestamp
   * @private
   */
  private toCategoryResponse(category: Category): CategoryResponse {
    return {
      id: category.id,
      name: category.name,
      createdAt: category.createdAt.toISOString(),
    };
  }
}
