#!/usr/bin/env node

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Get the directory paths
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Start the server and run tests
async function runIntegrationTests() {
  console.log('Starting mock backend server...');
  
  // Start the server process
  const server = spawn('node', ['--loader', 'ts-node/esm', 'src/mock-backend/start-simple.ts'], {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  // Log server output
  server.stdout.pipe(process.stdout);
  server.stderr.pipe(process.stderr);
  
  // Wait for server to start (simple approach)
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('Running integration tests...');
  
  // Run the tests
  const jest = spawn('npx', ['jest', '--config=jest.integration.config.js'], {
    cwd: rootDir,
    stdio: 'inherit'
  });
  
  // Handle test completion
  jest.on('close', (code) => {
    console.log(`Tests completed with exit code ${code}`);
    console.log('Shutting down server...');
    server.kill();
    process.exit(code);
  });
  
  // Handle process termination
  process.on('SIGINT', () => {
    console.log('Shutting down...');
    server.kill();
    process.exit(0);
  });
}

// Run the tests
runIntegrationTests(); 