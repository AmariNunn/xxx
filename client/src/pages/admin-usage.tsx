import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { BarChart, Users, Clock, Pencil, Play, Pause } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import SharedNavigation from "@/components/shared-navigation";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";

interface ClientUsageData {
  id: number;
  user_id: string;
  month_year: string;
  monthly_minutes: number;
  total_minutes_at_end: number;
  monthly_limit: number | null;
  last_benchmark_alerted: number;
  created_at: string;
  updated_at: string;
  users: {
    email: string;
    business_name: string;
    service_paused: boolean;
  };
}

export default function AdminUsage() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const userId = user?.id;
  const { toast } = useToast();

  // Edit dialog state
  const [editingRecord, setEditingRecord] = useState<ClientUsageData | null>(null);
  const [newLimit, setNewLimit] = useState<string>('');

  // Check if user is admin (audamaur@gmail.com)
  useEffect(() => {
    if (user && user.email !== 'audamaur@gmail.com') {
      setLocation('/dashboard');
    }
  }, [user, setLocation]);

  const handleLogout = () => {
    logout();
    setLocation('/login');
  };

  // Fetch usage data
  const { data: usageData, isLoading, error } = useQuery({
    queryKey: ['/api/admin/usage', userId],
    queryFn: async () => {
      if (!userId || !user?.email) return { usage: [] };
      
      const response = await fetch('/api/admin/usage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          email: user.email,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to fetch usage data');
      return await response.json();
    },
    enabled: !!userId && user?.email === 'audamaur@gmail.com',
  });

  const usage: ClientUsageData[] = usageData?.usage || [];

  // Update limit mutation
  const updateLimitMutation = useMutation({
    mutationFn: async ({ client_user_id, month_year, new_limit }: { 
      client_user_id: string; 
      month_year: string; 
      new_limit: number | null;
    }) => {
      const response = await fetch('/api/admin/update-limit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          email: user?.email,
          client_user_id,
          month_year,
          new_limit,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to update limit');
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/usage', userId] });
      toast({
        title: "Limit updated",
        description: "Client monthly limit has been updated successfully.",
      });
      setEditingRecord(null);
      setNewLimit('');
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEditClick = (record: ClientUsageData) => {
    setEditingRecord(record);
    setNewLimit(record.monthly_limit?.toString() || '');
  };

  const handleSaveLimit = () => {
    if (!editingRecord) return;
    
    // Convert empty string or zero to null (unlimited)
    const parsedLimit = newLimit === '' ? null : parseInt(newLimit);
    const limitValue = parsedLimit === 0 ? null : parsedLimit;
    
    updateLimitMutation.mutate({
      client_user_id: editingRecord.user_id,
      month_year: editingRecord.month_year,
      new_limit: limitValue,
    });
  };

  // Toggle service pause mutation
  const toggleServiceMutation = useMutation({
    mutationFn: async ({ client_user_id, pause }: { 
      client_user_id: string; 
      pause: boolean;
    }) => {
      const response = await fetch('/api/admin/toggle-service', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          email: user?.email,
          client_user_id,
          pause,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to toggle service');
      return await response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/usage', userId] });
      toast({
        title: variables.pause ? "Service paused" : "Service resumed",
        description: variables.pause 
          ? "Client can no longer make or receive calls." 
          : "Client can now make and receive calls.",
      });
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleToggleService = (client_user_id: string, currentPauseStatus: boolean) => {
    toggleServiceMutation.mutate({
      client_user_id,
      pause: !currentPauseStatus,
    });
  };

  // Calculate summary stats
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthUsage = usage.filter(u => u.month_year === currentMonth);
  const totalMinutesThisMonth = currentMonthUsage.reduce((sum, u) => sum + u.monthly_minutes, 0);
  const activeClients = new Set(currentMonthUsage.map(u => u.user_id)).size;
  const totalClients = new Set(usage.map(u => u.user_id)).size;

  if (user?.email !== 'audamaur@gmail.com') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <SharedNavigation currentPath="/admin/usage" onLogout={handleLogout} />
      
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <BarChart className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Client Usage Dashboard</h1>
              <p className="text-gray-600 dark:text-gray-400">Monitor client minute usage and benchmarks</p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card data-testid="card-total-minutes">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Minutes (This Month)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{totalMinutesThisMonth.toLocaleString()}</div>
              <p className="text-sm text-gray-500 mt-1">{currentMonth}</p>
            </CardContent>
          </Card>

          <Card data-testid="card-active-clients">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Clients</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{activeClients}</div>
              <p className="text-sm text-gray-500 mt-1">Used service this month</p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-clients">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Clients</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">{totalClients}</div>
              <p className="text-sm text-gray-500 mt-1">All time</p>
            </CardContent>
          </Card>
        </div>

        {/* Usage Table */}
        <Card data-testid="card-usage-table">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Client Usage Details
            </CardTitle>
            <CardDescription>Complete history of client minute usage</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <Clock className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="text-center py-12 text-red-600">
                Error loading usage data
              </div>
            ) : usage.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No usage data available yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead data-testid="header-client">Client</TableHead>
                      <TableHead data-testid="header-email">Email</TableHead>
                      <TableHead data-testid="header-month">Month</TableHead>
                      <TableHead className="text-right" data-testid="header-monthly-minutes">Monthly Minutes</TableHead>
                      <TableHead className="text-right" data-testid="header-total-minutes">Total Minutes</TableHead>
                      <TableHead className="text-center" data-testid="header-limit">Limit</TableHead>
                      <TableHead className="text-center" data-testid="header-benchmark">Last Alert</TableHead>
                      <TableHead className="text-center" data-testid="header-actions">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usage.map((record) => (
                      <TableRow key={record.id} data-testid={`row-usage-${record.id}`}>
                        <TableCell className="font-medium" data-testid={`text-business-${record.id}`}>
                          {record.users?.business_name || 'N/A'}
                        </TableCell>
                        <TableCell data-testid={`text-email-${record.id}`}>
                          {record.users?.email || 'N/A'}
                        </TableCell>
                        <TableCell data-testid={`text-month-${record.id}`}>
                          <Badge variant={record.month_year === currentMonth ? 'default' : 'secondary'}>
                            {record.month_year}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold" data-testid={`text-monthly-${record.id}`}>
                          {record.monthly_minutes.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-gray-600" data-testid={`text-total-${record.id}`}>
                          {record.total_minutes_at_end.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center" data-testid={`text-limit-${record.id}`}>
                          {record.monthly_limit ? (
                            record.monthly_minutes >= record.monthly_limit ? (
                              <Badge variant="destructive" className="bg-red-600">{record.monthly_limit} min</Badge>
                            ) : (
                              <Badge variant="outline">{record.monthly_limit} min</Badge>
                            )
                          ) : (
                            <Badge variant="secondary">Unlimited</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center" data-testid={`text-benchmark-${record.id}`}>
                          {record.last_benchmark_alerted > 0 ? (
                            <Badge variant="default">{record.last_benchmark_alerted} min</Badge>
                          ) : (
                            <span className="text-gray-400">None</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center" data-testid={`cell-actions-${record.id}`}>
                          <div className="flex justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditClick(record)}
                              data-testid={`button-edit-${record.id}`}
                              title="Edit monthly limit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant={record.users?.service_paused ? "default" : "ghost"}
                              size="sm"
                              onClick={() => handleToggleService(record.user_id, record.users?.service_paused || false)}
                              data-testid={`button-toggle-${record.id}`}
                              title={record.users?.service_paused ? "Resume service" : "Pause service"}
                              className={record.users?.service_paused ? "bg-green-600 hover:bg-green-700" : ""}
                            >
                              {record.users?.service_paused ? (
                                <Play className="h-4 w-4" />
                              ) : (
                                <Pause className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Limit Dialog */}
      <Dialog open={!!editingRecord} onOpenChange={(open) => !open && setEditingRecord(null)}>
        <DialogContent data-testid="dialog-edit-limit">
          <DialogHeader>
            <DialogTitle>Edit Monthly Limit</DialogTitle>
            <DialogDescription>
              Set the monthly minute limit for {editingRecord?.users?.business_name || 'this client'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Current Usage (This Month)</Label>
              <div className="text-2xl font-bold text-primary">
                {editingRecord?.monthly_minutes.toLocaleString()} minutes
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="limit-input">New Monthly Limit (minutes)</Label>
              <Input
                id="limit-input"
                type="number"
                placeholder="Leave empty for unlimited"
                value={newLimit}
                onChange={(e) => setNewLimit(e.target.value)}
                data-testid="input-new-limit"
              />
              <p className="text-sm text-gray-500">
                Leave empty or enter 0 for unlimited minutes
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setEditingRecord(null)}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveLimit}
                disabled={updateLimitMutation.isPending}
                data-testid="button-save-limit"
              >
                {updateLimitMutation.isPending ? 'Saving...' : 'Save Limit'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
