module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: 'e2e/.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../src/$1',
    '^@test/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/setup-e2e.ts'],
  testTimeout: 30000,
  // Run tests sequentially to avoid database conflicts
  maxWorkers: 1,
  // Load test environment variables
  setupFiles: ['<rootDir>/setup-env.js'],
  collectCoverageFrom: [
    '../src/**/*.ts',
    '!../src/**/*.spec.ts',
    '!../src/**/*.interface.ts',
    '!../src/**/*.module.ts',
    '!../src/main.ts',
    '!../src/test/**',
  ],
};
