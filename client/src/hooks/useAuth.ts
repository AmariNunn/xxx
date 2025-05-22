import { useState, useEffect } from 'react';
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// Type for user data
export type AuthUser = {
  id: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export function useAuth() {
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Make sure we're initialized on first load
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // Get current user data
  const { data: user, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/auth/currentUser'],
    queryFn: async () => {
      try {
        // Get user ID from localStorage
        const userId = localStorage.getItem('userId');
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
        // Clear invalid user data
        localStorage.removeItem('userId');
        return null;
      }
    },
    enabled: isInitialized,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Login function - store user data
  const login = async (userData: { id: number; email: string }) => {
    localStorage.setItem('userId', userData.id.toString());
    await refetch();
    return userData;
  };

  // Logout function - clear user data
  const logout = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('userEmail');
    refetch();
  };

  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
    login,
    logout,
    userId: user?.id || (localStorage.getItem('userId') ? Number(localStorage.getItem('userId')) : null)
  };
}