/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  
  // Transform configuration for ES modules
  transform: {
    '^.+\\.(ts|js)x?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'NodeNext',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          skipLibCheck: true,
        }
      },
    ],
  },
  
  // Module name mapping for ES module imports
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  
  // Don't transform node_modules except for MCP SDK
  transformIgnorePatterns: [
    'node_modules/(?!(@modelcontextprotocol)/)'
  ],
  
  // Test path configuration
  testMatch: [
    '<rootDir>/src/__tests__/**/*.test.ts',
  ],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/temp-tests/'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.test.{ts,js}',
    '!src/**/*.d.ts',
    '!src/test-utils/**',
    '!src/__tests__/**',
  ],
  
  // Test environment setup
  setupFilesAfterEnv: [],
  
  // Timeout for long-running tests
  testTimeout: 30000,
  
  // Note: globals configuration moved to transform options above
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Verbose output for debugging
  verbose: true,
  
  // Error handling
  errorOnDeprecated: false,
  
  // Test results configuration
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './test-results',
      outputName: 'comprehensive-test-results.xml',
    }]
  ]
};