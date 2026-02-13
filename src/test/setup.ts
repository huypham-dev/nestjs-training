// Mock uuid to avoid ESM issues in Jest
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123'),
}));
