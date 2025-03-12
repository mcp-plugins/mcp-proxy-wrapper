import { FastifyInstance, FastifyServerOptions } from 'fastify';

/**
 * Build a Fastify server instance with all routes configured
 * @param options Fastify server options
 * @returns Configured Fastify instance
 */
export function buildServer(options?: FastifyServerOptions): FastifyInstance;

/**
 * Start the server on the specified port
 * @param port Port to listen on (default: 3004)
 * @returns The started server instance
 */
export function startServer(port?: number): Promise<FastifyInstance>; 