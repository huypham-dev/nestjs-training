/**
 * Mock repository factory for MikroORM EntityRepository
 * Provides common repository methods with jest mock functions
 */
export const createMockRepository = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findAll: jest.fn(),
  findAndCount: jest.fn(),
  create: jest.fn(),
  persist: jest.fn(),
  flush: jest.fn(),
  remove: jest.fn(),
  removeAndFlush: jest.fn(),
  assign: jest.fn(),
  nativeUpdate: jest.fn(),
  nativeDelete: jest.fn(),
  count: jest.fn(),
  populate: jest.fn(),
});

/**
 * Mock EntityManager for MikroORM
 */
export const createMockEntityManager = () => {
  const flush = jest.fn();
  const persist = jest.fn().mockReturnValue({ flush });

  return {
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    persist,
    persistAndFlush: jest.fn(),
    flush,
    remove: jest.fn(),
    removeAndFlush: jest.fn(),
    assign: jest.fn(),
    populate: jest.fn(),
    fork: jest.fn(),
  };
};
