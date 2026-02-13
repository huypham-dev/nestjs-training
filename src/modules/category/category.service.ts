// Dependencies
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';

// Entities
import { Category } from './category.entity';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: EntityRepository<Category>
  ) {}

  async getAllCategories(): Promise<Category[]> {
    const data = await this.categoryRepository.findAll({
      orderBy: { name: 'ASC' },
    });

    return data;
  }
}
