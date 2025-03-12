import fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import { authRoutes } from './routes/auth.js';
import { billingRoutes } from './routes/billing.js';
import { DeveloperModel } from './models/developers.js';

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
  
  // Add API key validation middleware for protected routes
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
  server.register(authRoutes, { prefix: '/auth' });
  server.register(billingRoutes, { prefix: '/billing' });
  
  // Health check endpoint
  server.get('/health', async () => {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
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
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on http://localhost:${port}`);
    return server;
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
} 