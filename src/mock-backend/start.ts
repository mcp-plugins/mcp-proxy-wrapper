// Server startup file with robust error handling
import fastify from 'fastify';
import cors from '@fastify/cors';

console.log('Starting new server...');
console.log('Current directory:', process.cwd());
console.log('Node version:', process.version);

// Create the server
const server = fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname'
      }
    }
  }
});

// Register CORS
server.register(cors);

// Health check endpoint
server.get('/health', async () => {
  return { 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  };
});

// Dynamically import and register routes
const setupRoutes = async () => {
  try {
    console.log('Importing auth routes...');
    const authModule = await import('./routes/auth.js');
    console.log('Auth routes imported successfully');
    console.log('Auth module exports:', Object.keys(authModule));
    
    if (typeof authModule.authRoutes === 'function') {
      server.register(authModule.authRoutes, { prefix: '/auth' });
      console.log('Auth routes registered successfully');
    } else if (typeof authModule.default === 'function') {
      server.register(authModule.default, { prefix: '/auth' });
      console.log('Auth routes registered using default export');
    } else {
      console.error('authRoutes is not a function:', typeof authModule.authRoutes);
      console.error('default is not a function:', typeof authModule.default);
    }
  } catch (error) {
    console.error('Error importing auth routes:', error);
    console.error('Continuing without auth routes');
  }

  try {
    console.log('Importing billing routes...');
    const billingModule = await import('./routes/billing.js');
    console.log('Billing module exports:', Object.keys(billingModule));
    server.register(billingModule.billingRoutes, { prefix: '/billing' });
    console.log('Billing routes registered successfully');
  } catch (error) {
    console.error('Error importing billing routes:', error);
    console.error('Continuing without billing routes');
  }
};

// Start the server
const start = async () => {
  try {
    // Setup routes
    await setupRoutes();
    
    // Start listening
    await server.listen({ port: 3003, host: '0.0.0.0' });
    console.log('Server listening on http://localhost:3003');
    
    // Print registered routes for debugging
    console.log('Registered routes:');
    server.printRoutes();
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
};

// Handle errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
start(); 