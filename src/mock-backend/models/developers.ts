/**
 * Developer data model for the mock backend
 */

export interface Developer {
  id: string;
  name: string;
  email: string;
  apiKey: string;
  isAdmin: boolean;
  pricing: {
    tool: number;
    prompt: number;
    resource: number;
  };
  createdAt: string;
}

// In-memory database for developers
const developers: Record<string, Developer> = {
  'dev_123456': {
    id: 'dev_123456',
    name: 'Test Developer',
    email: 'dev@example.com',
    apiKey: 'valid-api-key',
    isAdmin: false,
    pricing: {
      tool: 0.05,
      prompt: 0.10,
      resource: 0.02
    },
    createdAt: new Date().toISOString()
  },
  'admin_123456': {
    id: 'admin_123456',
    name: 'Admin Developer',
    email: 'admin@example.com',
    apiKey: 'admin-api-key',
    isAdmin: true,
    pricing: {
      tool: 0.05,
      prompt: 0.10,
      resource: 0.02
    },
    createdAt: new Date().toISOString()
  }
};

// API key to developer ID mapping for quick lookups
const apiKeyMap: Record<string, string> = {
  'valid-api-key': 'dev_123456',
  'admin-api-key': 'admin_123456'
};

// Developer data access methods
export const DeveloperModel = {
  /**
   * Get a developer by API key
   */
  findByApiKey(apiKey: string): Developer | null {
    const developerId = apiKeyMap[apiKey];
    return developerId ? developers[developerId] : null;
  },

  /**
   * Get a developer by ID
   */
  findById(developerId: string): Developer | null {
    return developers[developerId] || null;
  },

  /**
   * Validate an API key
   */
  validateApiKey(apiKey: string): { valid: boolean; developerId?: string } {
    const developerId = apiKeyMap[apiKey];
    return developerId 
      ? { valid: true, developerId } 
      : { valid: false };
  },

  /**
   * Check if an API key has admin privileges
   */
  isAdmin(apiKey: string): boolean {
    const developer = this.findByApiKey(apiKey);
    return !!developer?.isAdmin;
  }
}; 