import fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import { authRoutes } from './routes/auth.js';
import { billingRoutes } from './routes/billing.js';
import { fileURLToPath } from 'url';

/**
 * Build a Fastify server instance with all routes configured
 * @param options Fastify server options
 * @returns Configured Fastify instance
 */
export function buildServer(options: FastifyServerOptions = {}): FastifyInstance {
  const server = fastify(options);
  
  // Register CORS plugin
  server.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
  });
  
  // Global hook for handling API key authentication
  server.addHook('onRequest', async (request, reply) => {
    // Skip API key validation for certain paths
    const skipApiKeyValidation = [
      '/health',
      '/docs',
    ];
    
    if (skipApiKeyValidation.some(path => request.url.startsWith(path))) {
      return;
    }
    
    const apiKey = request.headers['x-api-key'] as string;
    
    // For our mock implementation, we'll accept a few predefined API keys
    const validApiKeys = [
      'valid-api-key',
      'test-api-key',
      'admin-api-key'
    ];
    
    if (!apiKey || !validApiKeys.includes(apiKey)) {
      reply.code(401).send({
        valid: false,
        error: 'invalid_api_key',
        message: 'The provided API key is invalid or has been revoked'
      });
      return;
    }
  });
  
  // Register routes
  server.register(authRoutes, { prefix: '/auth' });
  server.register(billingRoutes, { prefix: '/billing' });
  
  // Health check endpoint
  server.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });
  
  return server;
}

/**
 * Start the server on the specified port
 * @param port Port to listen on (default: 3000)
 * @returns The started server instance
 */
export async function startServer(port: number = 3000): Promise<FastifyInstance> {
  const server = buildServer({
    logger: {
      level: 'info'
    }
  });
  
  try {
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on http://localhost:${port}`);
    return server;
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// If this file is run directly, start the server
// Check if this file is being run directly
const isMainModule = process.argv.length > 1 && 
  (process.argv[1] === fileURLToPath(import.meta.url) || 
   process.argv[1].endsWith('server.js') || 
   process.argv[1].endsWith('server.ts'));

if (isMainModule) {
  startServer();
} 