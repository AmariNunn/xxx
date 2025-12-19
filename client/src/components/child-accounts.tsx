import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Plus,
  Mail,
  Lock,
  Building2,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ChildAccount {
  id: string;
  email: string;
  business_name: string;
  created_at: string;
}

interface ChildAccountsProps {
  parentId: string;
}

export default function ChildAccounts({ parentId }: ChildAccountsProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Fetch child accounts
  const { data: childAccounts, isLoading } = useQuery<ChildAccount[]>({
    queryKey: [`/api/accounts/child/${parentId}`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/accounts/child/${parentId}`);
      if (!response.ok) throw new Error("Failed to fetch child accounts");
      const data = await response.json();
      return data.accounts;
    },
  });

  // Create child account mutation
  const createChildMutation = useMutation({
    mutationFn: async (data: { parentId: string; businessName: string; email: string; password: string }) => {
      const response = await apiRequest("POST", "/api/accounts/child", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create child account");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/accounts/child/${parentId}`] });
      toast({
        title: "Child account created",
        description: "The new account has been created successfully",
      });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create child account",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateAccount = () => {
    if (!businessName || !email || !password) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    createChildMutation.mutate({
      parentId,
      businessName,
      email,
      password,
    });
  };

  const resetForm = () => {
    setBusinessName("");
    setEmail("");
    setPassword("");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Child Accounts
            </CardTitle>
            <CardDescription>
              Manage multiple accounts under your parent account. Each child account has its own agents and integrations.
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-child-account">
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Child Account</DialogTitle>
                <DialogDescription>
                  Create a new account that you can manage and switch between. Each account can have its own AI agent and integrations.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="business-name">Account Name</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="business-name"
                      placeholder="Youth Group, Main Office, Events Team"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="pl-10"
                      data-testid="input-child-account-name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="account@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      data-testid="input-child-account-email"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      data-testid="input-child-account-password"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateAccount}
                  disabled={createChildMutation.isPending}
                  data-testid="button-submit-child-account"
                >
                  {createChildMutation.isPending ? "Creating..." : "Create Account"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading accounts...</div>
        ) : !childAccounts || childAccounts.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-2">No child accounts yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Create child accounts to manage multiple AI agents under one login
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {childAccounts.map((account) => (
                <TableRow key={account.id} data-testid={`row-child-account-${account.id}`}>
                  <TableCell className="font-medium">{account.business_name}</TableCell>
                  <TableCell>{account.email}</TableCell>
                  <TableCell>{new Date(account.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-blue-600 hover:text-blue-700"
                      onClick={() => {
                        // TODO: Implement account switching
                        toast({
                          title: "Switch Account",
                          description: `Switching to ${account.business_name}...`,
                        });
                      }}
                      data-testid={`button-switch-${account.id}`}
                    >
                      Switch
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
