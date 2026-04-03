// Dependencies
import { EntityRepository } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

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
