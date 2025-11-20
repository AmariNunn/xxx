import { AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ImpersonationState {
  data: any;
  isAdminImpersonating?: boolean;
  activeAccountId?: string;
  impersonatedAccount?: {
    id: string;
    email: string;
    business_name: string;
  };
}

export function ImpersonationBanner() {
  const { user } = useAuth();
  
  // Fetch current auth state to check impersonation status
  const { data: authState } = useQuery<ImpersonationState>({
    queryKey: ['/api/auth/currentUser'],
    enabled: !!user
  });

  // Exit impersonation mutation
  const exitImpersonationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/accounts/reset", {});
      return await res.json();
    },
    onSuccess: () => {
      // Invalidate all queries to refresh data
      queryClient.invalidateQueries();
      // Redirect to admin panel
      window.location.href = '/admin';
    }
  });

  const handleExitImpersonation = () => {
    exitImpersonationMutation.mutate();
  };

  // Only show banner if admin is impersonating
  if (!authState?.isAdminImpersonating || !authState?.impersonatedAccount) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2" data-testid="banner-impersonation">
      <div className="bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded-full px-3 py-1 flex items-center gap-2 shadow-sm">
        <AlertTriangle className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
        <span className="text-xs font-medium text-yellow-800 dark:text-yellow-200">
          Viewing: {authState.impersonatedAccount.email}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExitImpersonation}
        disabled={exitImpersonationMutation.isPending}
        className="bg-white dark:bg-gray-800 h-7 text-xs px-2 shadow-sm"
        data-testid="button-exit-impersonation"
      >
        <XCircle className="h-3 w-3 mr-1" />
        Exit
      </Button>
    </div>
  );
}
