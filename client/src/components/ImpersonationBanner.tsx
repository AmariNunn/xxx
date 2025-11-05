import { AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";

export function ImpersonationBanner() {
  const adminUserId = localStorage.getItem('adminUserId');
  const currentUserId = localStorage.getItem('userId');

  // Fetch current user info to show who we're viewing as
  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/user', currentUserId],
    queryFn: async () => {
      if (!currentUserId) return null;
      const response = await fetch(`/api/auth/user/${currentUserId}`);
      if (!response.ok) return null;
      const result = await response.json();
      return result.data;
    },
    enabled: !!currentUserId && !!adminUserId
  });

  const handleExitImpersonation = () => {
    // Restore admin user ID
    if (adminUserId) {
      localStorage.setItem('userId', adminUserId);
      localStorage.removeItem('adminUserId');
    }
    
    // Redirect to admin panel
    window.location.href = '/admin';
  };

  // Only show banner if we're impersonating (adminUserId exists)
  if (!adminUserId) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2" data-testid="banner-impersonation">
      <div className="bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded-full px-3 py-1 flex items-center gap-2 shadow-sm">
        <AlertTriangle className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
        <span className="text-xs font-medium text-yellow-800 dark:text-yellow-200">
          {currentUser?.email || 'user'}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExitImpersonation}
        className="bg-white dark:bg-gray-800 h-7 text-xs px-2 shadow-sm"
        data-testid="button-exit-impersonation"
      >
        <XCircle className="h-3 w-3 mr-1" />
        Exit
      </Button>
    </div>
  );
}
