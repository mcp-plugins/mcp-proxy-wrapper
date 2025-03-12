import fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';

// Use top-level await for imports
console.log('Loading server.ts module');

// Import routes and models
let authRoutes, billingRoutes, DeveloperModel;

try {
  console.log('Importing auth routes...');
  const authModule = await import('./routes/auth.js');
  authRoutes = authModule.authRoutes;
  console.log('Auth routes imported successfully');
} catch (error) {
  console.error('Error importing auth routes:', error);
  throw error;
}

try {
  console.log('Importing billing routes...');
  const billingModule = await import('./routes/billing.js');
  billingRoutes = billingModule.billingRoutes;
  console.log('Billing routes imported successfully');
} catch (error) {
  console.error('Error importing billing routes:', error);
  throw error;
}

try {
  console.log('Importing developer model...');
  const developerModule = await import('./models/developers.js');
  DeveloperModel = developerModule.DeveloperModel;
  console.log('Developer model imported successfully');
} catch (error) {
  console.error('Error importing developer model:', error);
  throw error;
}

console.log('All imports completed successfully');

/**
 * Build a Fastify server instance with all routes configured
 * @param options Fastify server options
 * @returns Configured Fastify instance
 */
export function buildServer(options: FastifyServerOptions = {}): FastifyInstance {
  console.log('Building server with options:', options);
  const server = fastify(options);
  
  // Register CORS plugin
  console.log('Registering CORS plugin');
  server.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
  });
  
  // Add API key validation middleware for protected routes
  console.log('Adding API key validation middleware');
  server.addHook('onRequest', async (request, reply) => {
    // Skip API key validation for health check and docs
    const publicPaths = [
      '/health',
      '/docs',
      '/auth/url'
    ];
    
    // Skip validation for public paths
    if (publicPaths.some(path => request.url.startsWith(path))) {
      return;
    }
    
    // Get API key from headers
    const apiKey = request.headers['x-api-key'] as string;
    if (!apiKey) {
      return reply.status(401).send({
        error: 'missing_api_key',
        message: 'API key is required'
      });
    }
    
    // Validate API key
    const validation = DeveloperModel.validateApiKey(apiKey);
    if (!validation.valid) {
      return reply.status(401).send({
        error: 'invalid_api_key',
        message: 'Invalid API key'
      });
    }
  });
  
  // Register routes
  console.log('Registering auth routes');
  server.register(authRoutes, { prefix: '/auth' });
  console.log('Registering billing routes');
  server.register(billingRoutes, { prefix: '/billing' });
  
  // Health check endpoint
  console.log('Adding health check endpoint');
  server.get('/health', async () => {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
  });
  
  console.log('Server build completed');
  return server;
}

/**
 * Start the server on the specified port
 * @param port Port to listen on (default: 3000)
 * @returns The started server instance
 */
export async function startServer(port: number = 3000): Promise<FastifyInstance> {
  console.log(`Starting server on port ${port}`);
  const server = buildServer({
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
  
  try {
    console.log('Attempting to listen on port', port);
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on http://localhost:${port}`);
    return server;
  } catch (err) {
    console.error('Error during server.listen():', err);
    server.log.error(err);
    process.exit(1);
  }
} 