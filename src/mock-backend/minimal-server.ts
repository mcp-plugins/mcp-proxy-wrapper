// Minimal server with just the auth URL endpoint
import fastify from 'fastify';
import cors from '@fastify/cors';

console.log('Starting minimal server...');

// Create the server
const server = fastify({
  logger: true
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

// Auth URL endpoint
server.get('/auth/url', async (request) => {
  const { redirectUrl, apiKey } = request.query as { redirectUrl?: string, apiKey?: string };
  
  // In a real implementation, this would generate a URL to the auth service
  const authUrl = `http://localhost:3000/auth/login?redirect=${encodeURIComponent(redirectUrl || '')}&apiKey=${apiKey || ''}`;
  
  return {
    url: authUrl
  };
});

// Start the server
const start = async () => {
  try {
    await server.listen({ port: 3004, host: '0.0.0.0' });
    console.log('Server listening on http://localhost:3004');
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
};

// Start the server
start(); 