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
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/users/profile`, {
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
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/users/stats`, {
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
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/users/profile`, {
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

  // Get user by ID
  async getUserById(userId: string): Promise<UserProfile> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/users/${userId}`, {
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
}

// Export singleton instance
export const userService = new UserService();

// Export types
export type { UserProfile, UserStats }; 