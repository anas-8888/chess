import { authService } from './authService';
import { API_BASE_URL } from '@/config/urls';

export interface Invite {
  id: string;
  fromUser: {
    user_id: string;
    username: string;
    email: string;
    thumbnail?: string;
    rank?: number;
    state?: string;
  };
  toUser: {
    user_id: string;
    username: string;
    email: string;
    thumbnail?: string;
    rank?: number;
    state?: string;
  };
  game?: {
    id: number;
    status: 'waiting' | 'active' | 'ended';
    ended_at?: string | null;
  } | null;
  game_id?: number;
  game_type: string;
  time_control?: number;
  play_method: string;
  date_time: string;
  expires_at: string;
  status: string;
}

class InviteService {
  private getAuthHeaders(): Record<string, string> {
    return authService.getAuthHeaders();
  }

  // Get received invites
  async getReceivedInvites(): Promise<Invite[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/invites/received`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في جلب الدعوات الواردة');
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching received invites:', error);
      throw error;
    }
  }

  // Accept invite with validation
  async acceptInvite(inviteId: string, playMethod: string = 'phone'): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/invites/${inviteId}/accept-validated`, {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          play_method: playMethod
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في قبول الدعوة');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error accepting invite:', error);
      throw error;
    }
  }

  // Decline invite
  async declineInvite(inviteId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/invites/${inviteId}/respond`, {
        method: 'PUT',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          response: 'reject'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في رفض الدعوة');
      }
    } catch (error) {
      console.error('Error declining invite:', error);
      throw error;
    }
  }

  // Start game from invite
  async startGame(inviteId: string, playMethod: string = 'phone'): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/invites/${inviteId}/start-game`, {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          play_method: playMethod
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في بدء المباراة');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error starting game:', error);
      throw error;
    }
  }

  // Get sent invites
  async getSentInvites(): Promise<Invite[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/invites/sent`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في جلب الدعوات المرسلة');
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching sent invites:', error);
      throw error;
    }
  }

  async getGameDetails(gameId: string | number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/game/${gameId}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'تعذر تحميل بيانات المباراة');
    }

    return response.json();
  }

  // Cancel sent invite
  async cancelInvite(inviteId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/invites/${inviteId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في إلغاء الدعوة');
      }
    } catch (error) {
      console.error('Error canceling invite:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const inviteService = new InviteService();
