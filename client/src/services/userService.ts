import { authService } from './authService';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  total_games: number;
  win_rate: number;
  created_at: string;
  updated_at: string;
}

export interface UserStats {
  wins: number;
  losses: number;
  draws: number;
  total_games: number;
  win_rate: number;
  rating: number;
}

class UserService {
  private getAuthHeaders(): Record<string, string> {
    return authService.getAuthHeaders();
  }

  // Get current user profile
  async getCurrentUserProfile(): Promise<UserProfile> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://192.168.1.6:3000'}/api/users/profile`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في جلب بيانات المستخدم');
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  }

  // Get user statistics
  async getUserStats(): Promise<UserStats> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://192.168.1.6:3000'}/api/users/stats`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في جلب إحصائيات المستخدم');
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      console.error('Error fetching user stats:', error);
      throw error;
    }
  }

  // Update user profile
  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://192.168.1.6:3000'}/api/users/profile`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في تحديث بيانات المستخدم');
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  // Update user status
  async updateStatus(status: 'online' | 'offline' | 'in-game'): Promise<void> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://192.168.1.6:3000'}/api/users/status`, {
        method: 'PUT',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Status update error:', errorData);
        // Don't throw error to avoid breaking the app
        // Just log it for debugging
        return;
      }

      const data = await response.json();
      console.log('Status updated:', data);
    } catch (error) {
      console.error('Error updating status:', error);
      // Don't throw error to avoid breaking the app
      // Just log it for debugging
    }
  }

  // Search users
  async searchUsers(query: string): Promise<any[]> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://192.168.1.6:3000'}/api/users/search?q=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: {
          ...this.getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to search users');
      }

      const data = await response.json();
      // API returns data directly, not wrapped in data property
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  }

  // Get user by ID
  async getUserById(userId: string): Promise<UserProfile> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://192.168.1.6:3000'}/api/users/${userId}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في جلب بيانات المستخدم');
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      console.error('Error fetching user by ID:', error);
      throw error;
    }
  }

  // Get current user status
  async getCurrentUserStatus(): Promise<{ user_id: string; state: string }> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://192.168.1.6:3000'}/api/users/status`, {
        method: 'GET',
        headers: {
          ...this.getAuthHeaders(),
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في جلب حالة المستخدم');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting current user status:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const userService = new UserService();

// Export types
export type { UserProfile, UserStats }; 