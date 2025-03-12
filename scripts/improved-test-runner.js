#!/usr/bin/env node

/**
 * Improved integration test runner
 * Starts the improved mock backend server and runs tests
 */
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Get the directory paths
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Server process and state tracking
let serverProcess = null;
let serverStarted = false;
let serverOutput = [];

/**
 * Start the mock backend server
 * @returns Promise that resolves when server is ready
 */
function startServer() {
  return new Promise((resolve, reject) => {
    console.log('Starting mock backend server...');
    
    serverProcess = spawn('node', ['--loader', 'ts-node/esm', 'src/mock-backend/improved-start.ts'], {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // Set up timeout for server startup
    const startupTimeout = setTimeout(() => {
      if (!serverStarted) {
        console.error('Server failed to start within 10 seconds');
        if (serverOutput.length > 0) {
          console.error('Last server output:');
          serverOutput.slice(-5).forEach(line => console.error(`  ${line}`));
        }
        reject(new Error('Server startup timeout'));
      }
    }, 10000);
    
    // Collect server output
    serverProcess.stdout.on('data', (data) => {
      const lines = data.toString().trim().split('\n');
      lines.forEach(line => {
        console.log(`[Server] ${line}`);
        serverOutput.push(line);
        
        // Check for server started message
        if (line.includes('Server listening on http://localhost:')) {
          serverStarted = true;
          clearTimeout(startupTimeout);
          resolve();
        }
      });
    });
    
    serverProcess.stderr.on('data', (data) => {
      const lines = data.toString().trim().split('\n');
      lines.forEach(line => {
        console.error(`[Server Error] ${line}`);
        serverOutput.push(line);
      });
    });
    
    // Handle server process exit
    serverProcess.on('exit', (code) => {
      if (!serverStarted) {
        reject(new Error(`Server process exited with code ${code} before starting`));
      } else {
        console.log(`Server process exited with code ${code}`);
      }
    });
    
    // Handle server process error
    serverProcess.on('error', (err) => {
      console.error('Failed to start server process:', err);
      reject(err);
    });
  });
}

/**
 * Run the integration tests
 * @returns Promise that resolves when tests complete
 */
function runTests() {
  return new Promise((resolve) => {
    console.log('Running integration tests...');
    
    const testProcess = spawn('npx', ['jest', '--config=jest.integration.config.js'], {
      cwd: rootDir,
      stdio: 'inherit'
    });
    
    testProcess.on('close', (code) => {
      console.log(`Integration tests completed with exit code ${code}`);
      resolve(code);
    });
  });
}

/**
 * Shutdown the server
 */
function shutdown() {
  if (serverProcess) {
    console.log('Shutting down mock backend server...');
    serverProcess.kill();
  }
}

/**
 * Main function to orchestrate the test run
 */
async function main() {
  try {
    // Start the server
    await startServer();
    
    // Run the tests
    const testCode = await runTests();
    
    // Shutdown the server
    shutdown();
    
    // Exit with the test exit code
    process.exit(testCode);
  } catch (error) {
    console.error('Error running integration tests:', error);
    shutdown();
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('Received SIGINT. Shutting down...');
  shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Shutting down...');
  shutdown();
  process.exit(0);
});

// Run the tests
main(); 