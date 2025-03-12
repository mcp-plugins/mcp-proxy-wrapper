import fastify from 'fastify';

// Create a simple Fastify server
const server = fastify({
  logger: true
});

// Add a simple health check route
server.get('/health', async () => {
  return { 
    status: 'ok', 
    timestamp: new Date().toISOString()
  };
});

// Start the server
const start = async () => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Server is running on http://localhost:3000');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Start the server
start(); 