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
  const { data: authData, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/auth/currentUser'],
    queryFn: async () => {
      try {
        // Fetch current user from session (includes impersonation info)
        const response = await fetch('/api/auth/currentUser', {
          credentials: 'include' // Important: send session cookie
        });
        
        if (response.status === 401) {
          // Not authenticated
          return null;
        }
        
        if (!response.ok) {
          throw new Error('Failed to fetch user');
        }
        
        const result = await response.json();
        return result; // Returns { data: user, isAdminImpersonating?, activeAccountId?, impersonatedAccount? }
      } catch (err) {
        console.error('Error fetching user:', err);
        return null;
      }
    },
    enabled: isInitialized,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry auth failures
  });
  
  // Extract user and active account ID
  const user = authData?.data || null;
  const activeAccountId = authData?.activeAccountId || authData?.data?.id;

  // Login function - invalidate cache and refetch user from session
  const login = async (userData: { id: string; email: string }) => {
    // Session is already set by the backend
    // Invalidate the auth query cache to force immediate refetch
    await queryClient.invalidateQueries({ queryKey: ['/api/auth/currentUser'] });
    // Refetch to get fresh auth state
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
    queryClient.resetQueries({ queryKey: ['/api/auth/currentUser'] });
    queryClient.clear();
    
    // Force complete page reload to login page
    window.location.replace('/login');
  };

  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
    isAdminImpersonating: authData?.isAdminImpersonating || false,
    impersonatedAccount: authData?.impersonatedAccount || null,
    login,
    logout,
    userId: activeAccountId // This now respects admin account switching!
  };
}