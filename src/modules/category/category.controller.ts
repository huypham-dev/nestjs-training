// Dependencies
import { Controller, Get } from '@nestjs/common';

// Services
import { CategoryService } from './category.service';

@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  async getAllCategories() {
    const result = await this.categoryService.getAllCategories();

    return {
      data: result.data,
      ...(result.meta ? { meta: result.meta } : {}),
    };
  }
}
