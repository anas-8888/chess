import { authService } from './authService';
import { API_BASE_URL } from '@/config/urls';

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
  isPlacement?: boolean;
  placementGamesPlayed?: number;
  placementMatches?: number;
  placementRemaining?: number;
  isNewPlayer?: boolean;
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

export interface UserSession {
  id?: string;
  session_id?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  expires_at?: string;
  last_activity?: string;
  is_current?: boolean;
}

export interface RecentGame {
  id: number;
  status: 'waiting' | 'active' | 'ended';
  game_type: string;
  started_at: string;
  ended_at?: string | null;
  opponent: string;
  color: 'white' | 'black';
  result: 'فوز' | 'خسارة' | 'تعادل' | 'جارية';
}

export interface GameMoveItem {
  san: string;
  playerId: number;
  playerName: string;
  timestamp: string;
}

export interface GameMovePair {
  moveNumber: number;
  white: GameMoveItem | null;
  black: GameMoveItem | null;
  fen: string | null;
}

export interface ActiveAiGameSession {
  gameId: number;
  playerColor: 'white' | 'black';
  aiLevel: number;
  initialTime: number;
  whiteTimeLeft: number;
  blackTimeLeft: number;
  currentFen: string;
  currentTurn: 'white' | 'black';
  status: 'active' | 'ended' | 'waiting';
  startedAt: string;
  clockSyncedAt?: string;
}

export interface ActiveGameSummary {
  id: number;
  status: 'waiting' | 'active' | 'ended';
  game_type: string;
  color: 'white' | 'black';
  started_at: string;
}

export interface RatingHistoryItem {
  gameId: number;
  endedAt: string;
  gameType: string;
  opponent: string;
  result: 'فوز' | 'خسارة' | 'تعادل';
  delta: number;
  ratingBefore: number;
  ratingAfter: number;
}

export interface RatingHistoryResponse {
  currentRating: number;
  lastDelta: number;
  isPlacement?: boolean;
  placementGamesPlayed?: number;
  placementMatches?: number;
  placementRemaining?: number;
  history: RatingHistoryItem[];
}

class UserService {
  private getAuthHeaders(): Record<string, string> {
    return authService.getAuthHeaders();
  }

  // Get current user profile
  async getCurrentUserProfile(): Promise<UserProfile> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في جلب بيانات المستخدم');
      }

      const data = await response.json();
      const profile = data.data || data;
      return {
        ...profile,
        avatar: profile.avatar || profile.thumbnail,
        rating: profile.rating || profile.rank || 1500,
      };
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  }

  // Get user statistics
  async getUserStats(): Promise<UserStats> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/stats`, {
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
      const payload: Record<string, unknown> = { ...updates };
      if (typeof updates.avatar === 'string') {
        payload.thumbnail = updates.avatar;
        delete payload.avatar;
      }

      const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
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
      const response = await fetch(`${API_BASE_URL}/api/users/status`, {
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

      await response.json();
    } catch (error) {
      console.error('Error updating status:', error);
      // Don't throw error to avoid breaking the app
      // Just log it for debugging
    }
  }

  // Search users
  async searchUsers(query: string): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/search?q=${encodeURIComponent(query)}`, {
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
      const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
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
      const response = await fetch(`${API_BASE_URL}/api/users/status`, {
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

  async getProfileStats(): Promise<UserProfile> {
    const response = await fetch(`${API_BASE_URL}/api/users/profile/stats`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'فشل في جلب إحصائيات الملف الشخصي');
    }

    const data = await response.json();
    const profile = data.data || data;
    return {
      ...profile,
      avatar: profile.avatar || profile.thumbnail,
      rating: profile.rating || profile.rank || 1500,
    };
  }

  async getRecentGames(limit = 10): Promise<RecentGame[]> {
    const response = await fetch(`${API_BASE_URL}/api/users/profile/recent-games?limit=${limit}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'فشل في جلب آخر المباريات');
    }

    const data = await response.json();
    return data.data || [];
  }

  async getCurrentActiveGame(): Promise<ActiveGameSummary | null> {
    const response = await fetch(`${API_BASE_URL}/api/users/games/active`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'فشل في جلب المباراة الجارية');
    }

    const data = await response.json();
    return data?.data || null;
  }

  async endCurrentGame(gameId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/users/games/${gameId}/end`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'فشل في إنهاء المباراة');
    }
  }

  async getGameMoves(gameId: number): Promise<GameMovePair[]> {
    const response = await fetch(`${API_BASE_URL}/api/game/${gameId}/moves`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'فشل في جلب سجل النقلات');
    }

    const data = await response.json();
    return data?.data?.moves || [];
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/users/change-password`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'فشل في تغيير كلمة المرور');
    }
  }

  async uploadAvatar(image: File | string): Promise<{ avatar: string; thumbnail: string }> {
    const token = authService.getToken();
    const authHeaders: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};

    const isFile = typeof image !== 'string';
    const response = await fetch(`${API_BASE_URL}/api/users/profile/avatar`, {
      method: 'POST',
      headers: isFile
        ? authHeaders
        : {
            ...authHeaders,
            'Content-Type': 'application/json',
          },
      body: isFile ? image : JSON.stringify({ imageData: image }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'فشل في رفع الصورة');
    }

    const data = await response.json();
    return data.data || data;
  }

  async getSessions(): Promise<UserSession[]> {
    const response = await fetch(`${API_BASE_URL}/api/users/sessions`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'فشل في جلب الجلسات');
    }

    const data = await response.json();
    const rows = Array.isArray(data) ? data : [];
    return rows.map((session: any) => ({
      ...session,
      id: session.id || session.session_id,
    }));
  }

  async revokeSession(sessionId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/users/sessions/revoke`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'فشل في إنهاء الجلسة');
    }
  }

  async revokeOtherSessions(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/users/sessions/revoke-others`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'فشل في إنهاء الجلسات الأخرى');
    }
  }

  async recordAiGameResult(payload: {
    result: 'win' | 'loss' | 'draw';
    playerColor: 'white' | 'black';
    aiLevel?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
    initialTime?: number;
    whiteTimeLeft?: number;
    blackTimeLeft?: number;
    finalFen?: string;
    startedAt?: string;
    endedAt?: string;
  }): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/game/ai/result`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'فشل في حفظ نتيجة مباراة الذكاء الاصطناعي');
    }
  }

  async createAiGameSession(payload: {
    playerColor: 'white' | 'black';
    aiLevel?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
    initialTime?: number;
  }): Promise<{ gameId: number; aiUserId: number; aiLevel?: number; difficulty?: 'easy' | 'medium' | 'hard' }> {
    const response = await fetch(`${API_BASE_URL}/api/game/ai/session`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const apiError = new Error(errorData.message || 'فشل في إنشاء مباراة الذكاء الاصطناعي') as Error & {
        status?: number;
        code?: string;
        data?: unknown;
      };
      apiError.status = response.status;
      apiError.code = errorData.code;
      apiError.data = errorData.data;
      throw apiError;
    }

    const data = await response.json();
    return data.data;
  }

  async getActiveAiGameSession(): Promise<ActiveAiGameSession | null> {
    const response = await fetch(`${API_BASE_URL}/api/game/ai/session/active`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'فشل في جلب جلسة مباراة الذكاء الاصطناعي');
    }

    const data = await response.json();
    return data?.data || null;
  }

  async syncGameClock(
    gameId: number,
    payload: {
      whiteTimeLeft: number;
      blackTimeLeft: number;
      currentTurn: 'white' | 'black';
    }
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/game/${gameId}/update-time`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'فشل في مزامنة وقت المباراة');
    }
  }

  async recordAiGameMove(
    gameId: number,
    payload: {
      from: string;
      to: string;
      promotion?: string;
      san: string;
      fenAfter: string;
      movedBy: 'human' | 'ai';
      nextTurn?: 'white' | 'black';
    }
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/game/ai/${gameId}/move`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'فشل في حفظ النقلة');
    }
  }

  async finalizeAiGame(
    gameId: number,
    payload: {
      result: 'win' | 'loss' | 'draw';
      finalFen: string;
      whiteTimeLeft: number;
      blackTimeLeft: number;
    }
  ): Promise<{
    ratingChanges?: {
      white?: { userId: number; delta: number; oldRating: number; newRating: number; isPlacement?: boolean; gamesPlayed?: number; kFactor?: number };
      black?: { userId: number; delta: number; oldRating: number; newRating: number; isPlacement?: boolean; gamesPlayed?: number; kFactor?: number };
    } | null;
  }> {
    const response = await fetch(`${API_BASE_URL}/api/game/ai/${gameId}/finalize`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'فشل في إنهاء مباراة الذكاء الاصطناعي');
    }

    const data = await response.json();
    return data?.data || {};
  }

  async getRatingHistory(limit = 30): Promise<RatingHistoryResponse> {
    const response = await fetch(`${API_BASE_URL}/api/users/profile/rating-history?limit=${limit}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'فشل في جلب سجل التقييم');
    }

    const data = await response.json();
    return data?.data || { currentRating: 1500, lastDelta: 0, history: [] };
  }
}

// Export singleton instance
export const userService = new UserService();

// Export types
export type { UserProfile, UserStats }; 

