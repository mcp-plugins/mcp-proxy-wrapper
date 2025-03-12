#!/usr/bin/env node

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Start the mock backend server
console.log('Starting mock backend server...');
const server = spawn('node', ['--loader', 'ts-node/esm', 'src/mock-backend/start.ts'], {
  cwd: rootDir,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
});

let serverStarted = false;
let serverError = null;

// Process server output
server.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(`[Server] ${output}`);
  
  if (output.includes('Server listening on http://localhost:3000')) {
    serverStarted = true;
    runTests();
  }
});

server.stderr.on('data', (data) => {
  console.error(`[Server Error] ${data.toString()}`);
  serverError = data.toString();
});

server.on('error', (error) => {
  console.error('Failed to start server process:', error);
  process.exit(1);
});

// Give the server 10 seconds to start
const timeout = setTimeout(() => {
  if (!serverStarted) {
    console.error('Server failed to start within timeout. Exiting...');
    if (serverError) {
      console.error('Last server error:', serverError);
    }
    server.kill();
    process.exit(1);
  }
}, 10000);

// Function to run the tests
function runTests() {
  clearTimeout(timeout);
  
  console.log('Server started. Running integration tests...');
  
  const jest = spawn('node', ['node_modules/.bin/jest', '--config=jest.integration.config.js'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
  });
  
  jest.on('exit', (code) => {
    console.log(`Jest process exited with code ${code}`);
    
    // Kill the server process
    console.log('Shutting down server...');
    server.kill();
    
    // Exit with the same code as Jest
    process.exit(code);
  });
  
  jest.on('error', (error) => {
    console.error('Failed to start Jest process:', error);
    server.kill();
    process.exit(1);
  });
}

// Handle process exit
process.on('exit', () => {
  if (server && !server.killed) {
    server.kill();
  }
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('Received SIGINT. Shutting down...');
  if (server && !server.killed) {
    server.kill();
  }
  process.exit(0);
}); 