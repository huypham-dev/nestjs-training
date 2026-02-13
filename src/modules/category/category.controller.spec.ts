import { Test, TestingModule } from '@nestjs/testing';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { createCategoryFixture } from '@/test/fixtures/category.fixture';

describe('CategoryController', () => {
  let controller: CategoryController;
  let categoryService: jest.Mocked<CategoryService>;

  beforeEach(async () => {
    // Create mock service
    const mockCategoryService = {
      getAllCategories: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [
        {
          provide: CategoryService,
          useValue: mockCategoryService,
        },
      ],
    }).compile();

    controller = module.get<CategoryController>(CategoryController);
    categoryService = module.get(CategoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllCategories', () => {
    it('should return all categories', async () => {
      // Arrange
      const categories = [
        createCategoryFixture({ id: '1', name: 'Tech' }),
        createCategoryFixture({ id: '2', name: 'Life' }),
        createCategoryFixture({ id: '3', name: 'Food' }),
      ];

      categoryService.getAllCategories.mockResolvedValue(categories);

      // Act
      const result = await controller.getAllCategories();

      // Assert
      expect(result.data).toHaveLength(3);
      expect(result.data).toEqual(
        categories.map((cat) => ({
          id: cat.id,
          name: cat.name,
          createdAt: cat.createdAt.toISOString(),
        }))
      );
      expect(categoryService.getAllCategories).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no categories exist', async () => {
      // Arrange
      categoryService.getAllCategories.mockResolvedValue([]);

      // Act
      const result = await controller.getAllCategories();

      // Assert
      expect(result).toEqual({
        data: [],
      });
      expect(result.data).toHaveLength(0);
    });

    it('should return categories with correct properties', async () => {
      // Arrange
      const category = createCategoryFixture({
        id: 'cat-123',
        name: 'Technology',
      });

      categoryService.getAllCategories.mockResolvedValue([category]);

      // Act
      const result = await controller.getAllCategories();

      // Assert
      expect(result.data[0]).toMatchObject({
        id: 'cat-123',
        name: 'Technology',
        createdAt: expect.any(String),
      });
    });
  });
});
