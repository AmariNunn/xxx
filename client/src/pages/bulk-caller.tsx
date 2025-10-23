import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import BulkCaller from '@/components/bulk-caller';
import BatchHistory from '@/components/batch-history';

export default function BulkCallerPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    setTimeout(() => setIsLoading(false), 500);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Please log in to access bulk calling</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Bulk Caller</h1>
            <p className="text-muted-foreground mt-1">
              Reach multiple contacts at once with AI-powered batch calling
            </p>
          </div>
        </div>

        {/* Bulk Caller Form */}
        <BulkCaller userId={userId} />

        {/* Batch History */}
        <BatchHistory userId={userId} />
      </div>
    </div>
  );
}
