module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  // ignore module.ts
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/database/**',
    '!**/migrations/**',
    '!**/common/**',
     '!**/config/**',
    '!**/main.ts',
    '!**/app.module.ts',
    '!**/*.module.ts',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
};
