import { startServer } from './server.js';

// Start the server on port 3000
startServer(3000).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
}); 