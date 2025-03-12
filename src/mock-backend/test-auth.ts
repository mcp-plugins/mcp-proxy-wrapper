// Test file for auth controller
import { AuthController } from './controllers/auth.js';

console.log('Auth controller imported successfully');
console.log('Auth controller methods:', Object.keys(AuthController));

// Test generateAuthUrl
const mockRequest = {
  query: {
    redirectUrl: 'http://example.com',
    apiKey: 'valid-api-key'
  }
};

const testAuthUrl = async () => {
  try {
    const result = await AuthController.generateAuthUrl(mockRequest as any);
    console.log('generateAuthUrl result:', result);
  } catch (error) {
    console.error('Error calling generateAuthUrl:', error);
  }
};

testAuthUrl(); 