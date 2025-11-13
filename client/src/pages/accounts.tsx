import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Users, Plus, ArrowRight } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const createChildAccountSchema = z.object({
  businessName: z.string().min(1, "Business name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type CreateChildAccountFormData = z.infer<typeof createChildAccountSchema>;

export default function AccountsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<CreateChildAccountFormData>({
    resolver: zodResolver(createChildAccountSchema),
    defaultValues: {
      businessName: "",
      email: "",
      password: "",
    },
  });

  // Fetch child accounts
  const { data: childAccounts, isLoading } = useQuery<any[]>({
    queryKey: ["/api/accounts/child", user?.id],
    enabled: !!user?.id,
  });

  // Create child account mutation
  const createChildMutation = useMutation({
    mutationFn: async (data: CreateChildAccountFormData) => {
      // parentId is now obtained from session on the backend
      const res = await apiRequest("POST", "/api/accounts/child", {
        businessName: data.businessName,
        email: data.email,
        password: data.password,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/child", user?.id] });
      toast({
        title: "Success",
        description: "Child account created successfully",
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create child account",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: CreateChildAccountFormData) => {
    createChildMutation.mutate(data);
  };

  const switchToAccount = (accountId: string, accountName: string) => {
    localStorage.setItem('activeAccountId', accountId);
    localStorage.setItem('activeAccountName', accountName);
    window.location.reload();
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Account Management</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage child accounts for your organization
            </p>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-account">
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Child Account</DialogTitle>
              <DialogDescription>
                Create a new child account under your organization. Each child account has its own
                independent integrations, agents, and call history.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Acme Corp - Sales Team"
                          data-testid="input-business-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="sales@acme.com"
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder="••••••••"
                          data-testid="input-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createChildMutation.isPending}
                    data-testid="button-create"
                  >
                    {createChildMutation.isPending ? "Creating..." : "Create Account"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Child Accounts Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading accounts...</div>
        ) : !childAccounts || childAccounts.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No child accounts yet</h3>
            <p className="text-muted-foreground mb-6">
              Create child accounts to manage separate teams, departments, or clients with
              independent configurations.
            </p>
            <Button onClick={() => setIsDialogOpen(true)} data-testid="button-create-first">
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Account
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {childAccounts.map((account: any) => (
                <TableRow key={account.id} data-testid={`row-account-${account.id}`}>
                  <TableCell className="font-medium">{account.business_name}</TableCell>
                  <TableCell>{account.email}</TableCell>
                  <TableCell>
                    {new Date(account.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => switchToAccount(account.id, account.business_name)}
                      data-testid={`button-switch-${account.id}`}
                    >
                      Switch
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          About Child Accounts
        </h3>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• Each child account has its own ElevenLabs, Twilio, and Cal.com integrations</li>
          <li>• Child accounts have completely independent AI agents and call history</li>
          <li>• You can switch between accounts instantly using the dropdown in the navigation</li>
          <li>• All data is isolated between accounts for security and privacy</li>
        </ul>
      </div>
    </div>
  );
}
