import { API_ENDPOINTS, getAuthHeaders } from '@/config/api';
import { ENV, API_TIMEOUT, ERROR_MESSAGES } from '@/config/environment';

// Types for API responses
export interface AuthResponse {
  token: string;
  user: {
    id: string;
    username: string;
    avatar?: string;
    rating: number;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

// Generic API client
class ApiClient {
  private async request<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || ERROR_MESSAGES.SERVER_ERROR);
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(ERROR_MESSAGES.NETWORK_ERROR);
      }
      
      throw error;
    }
  }

  // Auth API methods
  async login(data: LoginRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>(API_ENDPOINTS.AUTH.LOGIN, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>(API_ENDPOINTS.AUTH.REGISTER, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async logout(token: string): Promise<void> {
    return this.request<void>(API_ENDPOINTS.AUTH.LOGOUT, {
      method: 'POST',
      headers: getAuthHeaders(token),
    });
  }

  async validateToken(token: string): Promise<{ user: any }> {
    return this.request<{ user: any }>(API_ENDPOINTS.AUTH.VALIDATE, {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export types
export type { AuthResponse, LoginRequest, RegisterRequest }; 