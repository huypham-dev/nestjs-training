import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@mikro-orm/nestjs';

import { CategoryService } from './category.service';
import { Category } from './category.entity';

import { createMockRepository } from '@/test/mocks/repository.mock';
import { createCategoryFixture } from '@/test/fixtures/category.fixture';

describe('CategoryService', () => {
  let service: CategoryService;
  let categoryRepository: ReturnType<typeof createMockRepository>;

  beforeEach(async () => {
    // Create mock instances
    categoryRepository = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        {
          provide: getRepositoryToken(Category),
          useValue: categoryRepository,
        },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllCategories', () => {
    it('should return all categories sorted by name', async () => {
      // Arrange
      const categories = [
        createCategoryFixture({ id: 'cat-1', name: 'Technology' }),
        createCategoryFixture({ id: 'cat-2', name: 'Business' }),
        createCategoryFixture({ id: 'cat-3', name: 'Lifestyle' }),
      ];
      categoryRepository.findAll = jest.fn().mockResolvedValue(categories);

      // Act
      const result = await service.getAllCategories();

      // Assert
      expect(result).toEqual(categories);
      expect(categoryRepository.findAll).toHaveBeenCalledWith({
        orderBy: { name: 'ASC' },
      });
    });

    it('should return empty array when no categories exist', async () => {
      // Arrange
      categoryRepository.findAll = jest.fn().mockResolvedValue([]);

      // Act
      const result = await service.getAllCategories();

      // Assert
      expect(result).toEqual([]);
      expect(categoryRepository.findAll).toHaveBeenCalledWith({
        orderBy: { name: 'ASC' },
      });
    });
  });
});
