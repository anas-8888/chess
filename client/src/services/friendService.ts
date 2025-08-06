import { authService } from './authService';

export interface Friend {
  id: string;
  user_id: number;
  username: string;
  thumbnail?: string;
  rank: number;
  state: 'online' | 'offline' | 'in-game';
  is_online: boolean;
  friendship_id: number;
  is_initiator: boolean;
}

export interface FriendRequest {
  id: string;
  from_user: {
    id: string;
    username: string;
    avatar?: string;
    rating: number;
  };
  to_user: {
    id: string;
    username: string;
    avatar?: string;
    rating: number;
  };
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

class FriendService {
  private getAuthHeaders(): Record<string, string> {
    return authService.getAuthHeaders();
  }

  // Get friends list
  async getFriends(): Promise<Friend[]> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://192.168.204.221:3000'}/api/friends`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في جلب قائمة الأصدقاء');
      }

      const data = await response.json();
      console.log('Raw friends response:', data); // للتصحيح
      // تأكد من أن البيانات تأتي بالشكل الصحيح
      if (data.data && Array.isArray(data.data)) {
        return data.data;
      } else if (Array.isArray(data)) {
        return data;
      } else {
        console.error('Unexpected friends data format:', data);
        return [];
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
      throw error;
    }
  }

  // Get friend requests
  async getFriendRequests(): Promise<FriendRequest[]> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://192.168.204.221:3000'}/api/friends/requests`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في جلب طلبات الصداقة');
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      console.error('Error fetching friend requests:', error);
      throw error;
    }
  }

  // Get incoming friend requests
  async getIncomingRequests(): Promise<any[]> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://192.168.204.221:3000'}/api/friends/incoming`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في جلب طلبات الصداقة الواردة');
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching incoming friend requests:', error);
      throw error;
    }
  }

  // Send friend request
  async sendFriendRequest(userId: string): Promise<void> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://192.168.204.221:3000'}/api/friends/request`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ toUserId: userId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في إرسال طلب الصداقة');
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      throw error;
    }
  }

  // Accept friend request (by request ID)
  async acceptFriendRequest(requestId: string): Promise<void> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://192.168.204.221:3000'}/api/friends/request/${requestId}/accept`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في قبول طلب الصداقة');
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
      throw error;
    }
  }

  // Reject friend request (by request ID)
  async rejectFriendRequest(requestId: string): Promise<void> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://192.168.204.221:3000'}/api/friends/request/${requestId}/reject`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في رفض طلب الصداقة');
      }
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      throw error;
    }
  }

  // Remove friend
  async removeFriend(friendId: string): Promise<void> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://192.168.204.221:3000'}/api/friends/${friendId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في إزالة الصديق');
      }
    } catch (error) {
      console.error('Error removing friend:', error);
      throw error;
    }
  }

  // Search users
  async searchUsers(query: string): Promise<Friend[]> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://192.168.204.221:3000'}/api/users/search?q=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في البحث عن المستخدمين');
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const friendService = new FriendService(); 