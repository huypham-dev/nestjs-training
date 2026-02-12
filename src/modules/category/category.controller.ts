// Dependencies
import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';

// Services
import { CategoryService } from './category.service';
import { Category } from './category.entity';
import { CategoryResponse } from './category.dto';

@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
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
