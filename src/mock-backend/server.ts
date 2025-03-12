import Fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import { registerAuthRoutes } from './routes/auth.js';
import { registerBillingRoutes } from './routes/billing.js';

export function buildServer(options: FastifyServerOptions = {}): FastifyInstance {
  const server = Fastify(options);
  
  // Register CORS
  server.register(cors, {
    origin: true, // Allow all origins for testing
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-API-Key'],
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
  
  // Health check endpoint
  server.get('/health', async () => {
    return { status: 'ok' };
  });
  
  // Register route handlers
  registerAuthRoutes(server);
  registerBillingRoutes(server);
  
  return server;
}

// Function to start the server if this file is executed directly
if (process.argv[1] === import.meta.url) {
  const server = buildServer({
    logger: true,
  });
  
  server.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Server listening at ${address}`);
  });
} 