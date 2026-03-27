import { STORAGE_KEYS } from '@/config/environment';
import { API_BASE_URL } from '@/config/urls';

// Types for authentication
export interface User {
  id: string;
  username: string;
  avatar?: string;
  rating: number;
  email: string;
  type?: 'user' | 'admin';
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  loading: boolean;
}

// Auth service class
class AuthService {
  private token: string | null = null;
  private user: User | null = null;

  constructor() {
    this.loadFromStorage();
  }

  // Load authentication data from localStorage
  private loadFromStorage(): void {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
      const userStr = localStorage.getItem(STORAGE_KEYS.USER);
      
      if (token && userStr) {
        this.token = token;
        this.user = JSON.parse(userStr);
      }
    } catch (error) {
      console.error('Error loading auth data from storage:', error);
      this.clearAuth();
    }
  }

  // Save authentication data to localStorage
  private saveToStorage(): void {
    try {
      if (this.token) {
        localStorage.setItem(STORAGE_KEYS.TOKEN, this.token);
      }
      if (this.user) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(this.user));
      }
    } catch (error) {
      console.error('Error saving auth data to storage:', error);
    }
  }

  // Clear authentication data
  private clearAuth(): void {
    this.token = null;
    this.user = null;
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
  }

  // Check if user is authenticated
  public isAuthenticated(): boolean {
    return !!this.token && !!this.user;
  }

  // Get current user
  public getCurrentUser(): User | null {
    return this.user;
  }

  // Get current token
  public getToken(): string | null {
    return this.token;
  }

  // Set authentication data
  public setAuth(token: string, user: User): void {
    this.token = token;
    this.user = user;
    this.saveToStorage();
  }

  // Clear authentication (logout)
  public async logout(): Promise<void> {
    // Call server logout API first if we have a token
    if (this.token) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
          }
        });
        
        if (response.ok) {
          console.log('Successfully logged out from server');
        } else {
          console.warn('Server logout failed, but continuing with local logout');
        }
      } catch (error) {
        console.error('Error during server logout:', error);
        // Continue with local logout even if server logout fails
      }
    }
    
    // Clear local authentication data
    this.clearAuth();
  }

  // Validate token with server
  public async validateToken(): Promise<boolean> {
    if (!this.token) {
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ token: this.token })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // Update user data if needed
          this.user = {
            id: data.data.user_id,
            username: data.data.username,
            rating: data.data.rank || 1500,
            email: data.data.email,
            avatar: data.data.thumbnail,
            type: data.data.type,
          };
          this.saveToStorage();
          return true;
        }
      }
      
      // If validation fails, clear auth
      this.clearAuth();
      return false;
    } catch (error) {
      console.error('Token validation error:', error);
      this.clearAuth();
      return false;
    }
  }

  // Refresh token
  public async refreshToken(): Promise<boolean> {
    if (!this.token) {
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: this.token })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.token) {
          this.token = data.data.token;
          this.saveToStorage();
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }

  // Get auth headers for API requests
  public getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    return headers;
  }
}

// Export singleton instance
export const authService = new AuthService(); 
