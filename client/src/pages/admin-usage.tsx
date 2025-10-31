import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { BarChart, Users, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import SharedNavigation from "@/components/shared-navigation";
import { useAuth } from "@/hooks/useAuth";

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
  };
}

export default function AdminUsage() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const userId = user?.id;

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
                            <Badge variant="outline">{record.monthly_limit} min</Badge>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
