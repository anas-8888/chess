import { apiClient } from '@/services/api';

// Test function to verify API connection
export async function testApiConnection() {
  try {
    console.log('Testing API connection...');
    
    // Test with invalid credentials to check if API is reachable
    try {
      await apiClient.login({
        email: 'test@test.com',
        password: 'wrongpassword'
      });
    } catch (error: any) {
      // If we get an authentication error, the API is working
      if (error.message.includes('بيانات الدخول') || error.message.includes('401')) {
        console.log('✅ API connection successful');
        return true;
      }
    }
    
    console.log('❌ API connection failed');
    return false;
  } catch (error) {
    console.error('❌ API connection error:', error);
    return false;
  }
}

// Test function to check environment variables
export function testEnvironment() {
  console.log('Environment check:');
  console.log('- API URL:', import.meta.env.VITE_API_URL || 'http://localhost:3000 (default)');
  console.log('- Development mode:', import.meta.env.DEV);
  console.log('- Production mode:', import.meta.env.PROD);
} 