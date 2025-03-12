/**
 * User data model for the mock backend
 */

export interface User {
  id: string;
  name: string;
  email: string;
  balance: number;
  lastActivity: string;
  permissions: string[];
}

// In-memory database for users
const users: Record<string, User> = {
  'user_123456': {
    id: 'user_123456',
    name: 'Test User',
    email: 'test@example.com',
    balance: 100.00,
    lastActivity: new Date().toISOString(),
    permissions: ['basic_access']
  },
  'low-funds-user': {
    id: 'low-funds-user',
    name: 'Low Funds User',
    email: 'lowfunds@example.com',
    balance: 0.05,
    lastActivity: new Date().toISOString(),
    permissions: ['basic_access']
  },
  'premium-user': {
    id: 'premium-user',
    name: 'Premium User',
    email: 'premium@example.com',
    balance: 500.00,
    lastActivity: new Date().toISOString(),
    permissions: ['basic_access', 'premium_features']
  }
};

// User data access methods
export const UserModel = {
  /**
   * Get a user by ID
   */
  findById(userId: string): User | null {
    return users[userId] || null;
  },

  /**
   * Create a new user
   */
  create(userData: Omit<User, 'lastActivity'>): User {
    const user: User = {
      ...userData,
      lastActivity: new Date().toISOString()
    };
    users[user.id] = user;
    return user;
  },

  /**
   * Update a user's balance
   */
  updateBalance(userId: string, newBalance: number): User | null {
    const user = users[userId];
    if (!user) return null;
    
    user.balance = newBalance;
    user.lastActivity = new Date().toISOString();
    
    return user;
  },

  /**
   * List all users (for admin purposes)
   */
  list(): User[] {
    return Object.values(users);
  }
}; 