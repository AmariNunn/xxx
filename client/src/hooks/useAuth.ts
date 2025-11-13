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

  // Get current user data
  // Use activeAccountId if it exists (for child account switching), otherwise use userId
  const getActiveUserId = () => {
    if (typeof window === 'undefined') return null;
    const activeAccountId = localStorage.getItem('activeAccountId');
    const userId = localStorage.getItem('userId');
    return activeAccountId || userId;
  };

  const activeUserId = getActiveUserId();

  const { data: user, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/auth/currentUser', activeUserId],
    queryFn: async () => {
      try {
        // Get active account ID (could be parent or child account)
        const userId = getActiveUserId();
        if (!userId) {
          return null;
        }
        
        // Fetch user data from server
        const response = await fetch(`/api/auth/user/${userId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch user');
        }
        
        const userData = await response.json();
        return userData.data;
      } catch (err) {
        console.error('Error fetching user:', err);
        // Don't clear storage on every error - could be network issue
        return null;
      }
    },
    enabled: isInitialized && !!activeUserId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Login function - store user data
  const login = async (userData: { id: string; email: string }) => {
    localStorage.setItem('userId', userData.id);
    await refetch();
    return userData;
  };

  // Logout function - clear user data and force refresh
  const logout = () => {
    // Clear all authentication data from local storage
    localStorage.removeItem('userId');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('activeAccountId'); // Also clear active account
    localStorage.removeItem('activeAccountName');
    
    // Reset query cache to ensure no stale auth data remains
    queryClient.resetQueries({ queryKey: ['/api/auth/currentUser'] });
    queryClient.clear();
    
    // Force complete page reload to login page
    window.location.replace('/login');
    
    // Backup approach - direct DOM manipulation as a last resort
    setTimeout(() => {
      document.location.href = '/login';
    }, 100);
  };

  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
    login,
    logout,
    userId: user?.id || getActiveUserId(),
    isChildAccount: !!localStorage.getItem('activeAccountId') && 
                     localStorage.getItem('activeAccountId') !== localStorage.getItem('userId')
  };
}