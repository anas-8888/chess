import { authService } from './authService';

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
  game_type: string;
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
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/invites/received`, {
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

  // Accept invite
  async acceptInvite(inviteId: string): Promise<void> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/invites/respond`, {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inviteId: inviteId,
          response: 'accept'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في قبول الدعوة');
      }
    } catch (error) {
      console.error('Error accepting invite:', error);
      throw error;
    }
  }

  // Decline invite
  async declineInvite(inviteId: string): Promise<void> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/invites/respond`, {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inviteId: inviteId,
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
}

// Export singleton instance
export const inviteService = new InviteService(); 