/**
 * E2E Test Setup
 * - Mock uuid for consistent test data
 */

// Helper to generate valid UUID v4 format
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Mock uuid module globally for E2E tests
jest.mock('uuid', () => ({
  v4: jest.fn(() => generateUUID()),
  v7: jest.fn(() => generateUUID()),
}));
