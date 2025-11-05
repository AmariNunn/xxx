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
    <Alert className="rounded-none border-x-0 border-t-0 border-b bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800 py-1.5" data-testid="banner-impersonation">
      <AlertTriangle className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
      <AlertDescription className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-yellow-800 dark:text-yellow-200">
            Admin Mode:
          </span>
          <span className="text-yellow-700 dark:text-yellow-300">
            Viewing as <strong>{currentUser?.email || 'user'}</strong>
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExitImpersonation}
          className="bg-white dark:bg-gray-800 h-6 text-xs px-2 py-0"
          data-testid="button-exit-impersonation"
        >
          <XCircle className="h-3 w-3 mr-1" />
          Exit
        </Button>
      </AlertDescription>
    </Alert>
  );
}
