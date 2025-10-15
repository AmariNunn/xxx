import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { 
  Shield, 
  Users, 
  Eye, 
  LogOut,
  Search,
  UserCheck
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedUser, setImpersonatedUser] = useState<any>(null);
  const [realAdminId, setRealAdminId] = useState("");
  
  const adminId = localStorage.getItem('userId');

  // Check if user is admin
  const { data: adminCheck } = useQuery({
    queryKey: ['/api/admin/check', adminId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/admin/check/${adminId}`);
      return response.json();
    },
    enabled: !!adminId
  });

  // Check if currently impersonating
  useEffect(() => {
    const impersonating = localStorage.getItem('isImpersonating') === 'true';
    const realAdmin = localStorage.getItem('realAdminId');
    const impersonated = localStorage.getItem('impersonatedUser');
    
    if (impersonating && realAdmin && impersonated) {
      setIsImpersonating(true);
      setRealAdminId(realAdmin);
      setImpersonatedUser(JSON.parse(impersonated));
    }
  }, []);

  // Redirect if not admin
  useEffect(() => {
    if (adminCheck && !adminCheck.isAdmin) {
      toast({
        title: "Access Denied",
        description: "You don't have admin privileges",
        variant: "destructive"
      });
      setLocation('/dashboard');
    }
  }, [adminCheck]);

  // Fetch all users
  const { data: usersData, refetch } = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: adminId })
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
    enabled: !!adminId && adminCheck?.isAdmin === true
  });

  const handleImpersonate = async (user: any) => {
    try {
      const response = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          userId: adminId,
          targetUserId: user.id 
        })
      });

      if (!response.ok) throw new Error('Impersonation failed');

      const data = await response.json();
      
      // Store impersonation state
      localStorage.setItem('isImpersonating', 'true');
      localStorage.setItem('realAdminId', adminId!);
      localStorage.setItem('impersonatedUser', JSON.stringify(data.user));
      
      // Switch to impersonated user
      localStorage.setItem('userId', data.user.id);
      localStorage.setItem('userEmail', data.user.email);
      
      toast({
        title: "Impersonation Started",
        description: `You are now viewing as ${data.user.business_name || data.user.email}`
      });
      
      // Redirect to user's dashboard
      window.location.href = '/dashboard';
    } catch (error) {
      toast({
        title: "Impersonation Failed",
        description: error instanceof Error ? error.message : "Failed to impersonate user",
        variant: "destructive"
      });
    }
  };

  const handleEndImpersonation = async () => {
    try {
      const response = await fetch('/api/admin/end-impersonation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: realAdminId,
          targetUserId: impersonatedUser?.id,
          targetUserEmail: impersonatedUser?.email
        })
      });

      if (!response.ok) throw new Error('Failed to end impersonation');

      // Restore admin session
      localStorage.setItem('userId', realAdminId);
      localStorage.removeItem('isImpersonating');
      localStorage.removeItem('realAdminId');
      localStorage.removeItem('impersonatedUser');
      localStorage.removeItem('userEmail');
      
      toast({
        title: "Impersonation Ended",
        description: "Returned to admin view"
      });
      
      // Redirect to admin dashboard
      window.location.href = '/admin';
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to end impersonation",
        variant: "destructive"
      });
    }
  };

  if (!adminCheck?.isAdmin) {
    return null;
  }

  const filteredUsers = usersData?.users?.filter((user: any) => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.business_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        {/* Impersonation Banner */}
        {isImpersonating && (
          <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                <div>
                  <p className="font-semibold text-yellow-800 dark:text-yellow-200">
                    Admin Impersonation Active
                  </p>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    Viewing as: {impersonatedUser?.business_name || impersonatedUser?.email}
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                onClick={handleEndImpersonation}
                data-testid="button-end-impersonation"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Exit Impersonation
              </Button>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-6 w-6" />
                  Admin Dashboard
                </CardTitle>
                <CardDescription>Manage users and impersonate accounts</CardDescription>
              </div>
              <Button 
                variant="outline" 
                onClick={() => setLocation('/dashboard')}
                data-testid="button-back-dashboard"
              >
                Back to Dashboard
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by email or business name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-users"
                />
              </div>
            </div>

            {/* Users Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Service Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers?.map((user: any) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell className="font-medium">
                        {user.business_name || 'N/A'}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.phone_number || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {user.service_plan}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.verified ? (
                          <Badge variant="default">Verified</Badge>
                        ) : (
                          <Badge variant="secondary">Unverified</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.is_admin ? (
                          <Badge variant="destructive">Admin</Badge>
                        ) : (
                          <Badge variant="outline">User</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleImpersonate(user)}
                          disabled={user.id === adminId}
                          data-testid={`button-impersonate-${user.id}`}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Impersonate
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredUsers?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No users found
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
