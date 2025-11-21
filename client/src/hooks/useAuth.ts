import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// Type for user data
export type AuthUser = {
  id: string; // UUID string from database
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  isAdmin?: boolean;
}

export function useAuth() {
  const [isInitialized, setIsInitialized] = useState(false);
  const queryClient = useQueryClient();
  
  // Make sure we're initialized on first load
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // Get current user data from session
  const { data: user, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/auth/me'],
    queryFn: async () => {
      try {
        // Fetch current user from session (no need for localStorage!)
        const response = await fetch('/api/auth/me', {
          credentials: 'include' // Important: send session cookie
        });
        
        if (response.status === 401) {
          // Not authenticated
          return null;
        }
        
        if (!response.ok) {
          throw new Error('Failed to fetch user');
        }
        
        const userData = await response.json();
        return userData.user;
      } catch (err) {
        console.error('Error fetching user:', err);
        return null;
      }
    },
    enabled: isInitialized,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry auth failures
  });

  // Login function - just refetch user from session
  const login = async (userData: { id: string; email: string }) => {
    // Session is already set by the backend
    // Just refetch the user data to update the UI
    await refetch();
    return userData;
  };

  // Logout function - call backend logout endpoint and clear state
  const logout = async () => {
    try {
      // Call backend logout endpoint to destroy session
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      console.error('Error during logout:', err);
    }
    
    // Reset query cache to ensure no stale auth data remains
    queryClient.resetQueries({ queryKey: ['/api/auth/me'] });
    queryClient.clear();
    
    // Force complete page reload to login page
    window.location.replace('/login');
  };

  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
    login,
    logout,
    userId: user?.id
  };
}