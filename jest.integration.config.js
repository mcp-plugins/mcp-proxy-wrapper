// Jest config for integration tests
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/integration-tests/**/*.integration.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  verbose: true,
  testTimeout: 30000, // 30 seconds timeout for integration tests
}; 