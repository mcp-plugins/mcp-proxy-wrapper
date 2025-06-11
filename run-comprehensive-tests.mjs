#!/usr/bin/env node

/**
 * Test runner for comprehensive MCP Proxy Wrapper tests
 * 
 * This script runs the comprehensive test suite using the built distribution files
 * to ensure tests work with the actual compiled output.
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runTests() {
  console.log('🧪 Starting MCP Proxy Wrapper Comprehensive Tests...\n');
  
  // Check if dist folder exists
  const distPath = join(__dirname, 'dist');
  if (!existsSync(distPath)) {
    console.error('❌ dist/ folder not found. Please run "npm run build" first.');
    process.exit(1);
  }
  
  // Check if test files exist
  const testPath = join(__dirname, 'src/__tests__');
  if (!existsSync(testPath)) {
    console.error('❌ Test files not found in src/__tests__/');
    process.exit(1);
  }
  
  console.log('✅ Build files found');
  console.log('✅ Test files found');
  console.log('🚀 Running comprehensive test suite...\n');
  
  // Run Jest with our custom config
  const jestArgs = [
    'node_modules/.bin/jest',
    '--config=jest.config.comprehensive.js',
    '--verbose',
    '--detectOpenHandles',
    '--forceExit'
  ];
  
  const jest = spawn('node', jestArgs, {
    stdio: 'inherit',
    shell: false
  });
  
  jest.on('close', (code) => {
    if (code === 0) {
      console.log('\n🎉 All comprehensive tests passed!');
      console.log('✅ MCP Proxy Wrapper is working correctly');
      console.log('✅ Protocol compliance verified');
      console.log('✅ Edge cases handled properly');
    } else {
      console.log(`\n❌ Tests failed with exit code ${code}`);
      process.exit(code);
    }
  });
  
  jest.on('error', (error) => {
    console.error('❌ Failed to start test runner:', error);
    process.exit(1);
  });
}

// Handle script termination
process.on('SIGINT', () => {
  console.log('\n🛑 Tests interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Tests terminated');
  process.exit(1);
});

// Run the tests
runTests().catch(error => {
  console.error('❌ Test runner error:', error);
  process.exit(1);
});