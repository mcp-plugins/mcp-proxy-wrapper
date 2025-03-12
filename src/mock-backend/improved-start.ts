/**
 * Mock backend server startup script
 */
import { startServer } from './server.js';

// Start the server on port 3000
startServer(3000)
  .then(server => {
    // Set up graceful shutdown
    const shutdown = () => {
      server.log.info('Shutting down server...');
      server.close(() => {
        server.log.info('Server shut down successfully');
        process.exit(0);
      });
    };
    
    // Handle Ctrl+C and other shutdown signals
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  })
  .catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  }); 