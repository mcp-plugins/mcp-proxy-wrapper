#!/usr/bin/env node

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Get the directory paths
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Server process reference
let serverProcess = null;
let serverErrors = [];

// Start the mock backend server
console.log('Starting mock backend server...');
serverProcess = spawn('node', ['--loader', 'ts-node/esm', 'src/mock-backend/start.ts'], {
  cwd: rootDir,
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: false
});

// Collect server output
let serverStarted = false;
const serverStartTimeout = 10000; // 10 seconds
const startTime = Date.now();

serverProcess.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(`[Server] ${output.trim()}`);
  
  // Check if server has started
  if (output.includes('Server listening')) {
    serverStarted = true;
    runTests();
  }
});

serverProcess.stderr.on('data', (data) => {
  const error = data.toString();
  console.error(`[Server Error] ${error.trim()}`);
  serverErrors.push(error);
});

serverProcess.on('error', (error) => {
  console.error('Failed to start server process:', error);
  process.exit(1);
});

// Check if server started within timeout
const checkServerStarted = setTimeout(() => {
  if (!serverStarted) {
    console.error(`Server failed to start within timeout. Exiting...`);
    if (serverErrors.length > 0) {
      console.error(`Last server error: ${serverErrors[serverErrors.length - 1]}`);
    }
    
    // Kill the server process if it's still running
    if (serverProcess) {
      serverProcess.kill();
    }
    
    process.exit(1);
  }
}, serverStartTimeout);

// Function to run the tests
function runTests() {
  clearTimeout(checkServerStarted);
  console.log('Server started successfully. Running integration tests...');
  
  // Run Jest with the integration config
  const jestProcess = spawn('npx', ['jest', '--config=jest.integration.config.js'], {
    cwd: rootDir,
    stdio: 'inherit'
  });
  
  jestProcess.on('close', (code) => {
    console.log(`Integration tests completed with exit code ${code}`);
    
    // Kill the server process
    if (serverProcess) {
      console.log('Shutting down mock backend server...');
      serverProcess.kill();
    }
    
    process.exit(code);
  });
}

// Handle process exit
process.on('exit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('Received SIGINT. Shutting down...');
  if (serverProcess) {
    serverProcess.kill();
  }
  process.exit(0);
});

// Handle termination
process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Shutting down...');
  if (serverProcess) {
    serverProcess.kill();
  }
  process.exit(0);
}); 