import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Check, ChevronDown, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface ChildAccount {
  id: string;
  email: string;
  business_name: string;
}

interface AccountSwitcherProps {
  parentId: string;
  currentAccountId: string;
  onSwitch: (accountId: string, accountName: string) => void;
}

export default function AccountSwitcher({ parentId, currentAccountId, onSwitch }: AccountSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Fetch child accounts
  const { data: childAccounts } = useQuery<ChildAccount[]>({
    queryKey: [`/api/accounts/child/${parentId}`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/accounts/child/${parentId}`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.accounts || [];
    },
  });

  // Fetch parent account details
  const { data: parentAccount } = useQuery<{id: string; businessName: string}>({
    queryKey: [`/api/auth/user/${parentId}`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/auth/user/${parentId}`);
      if (!response.ok) return { id: parentId, businessName: "My Account" };
      const result = await response.json();
      return { 
        id: result.data.id, 
        businessName: result.data.businessName || "My Account" 
      };
    },
  });

  // Don't show switcher if there are no child accounts
  if (!childAccounts || childAccounts.length === 0) {
    return null;
  }

  const currentAccount = currentAccountId === parentId 
    ? parentAccount 
    : childAccounts?.find(acc => acc.id === currentAccountId);

  const currentAccountName = currentAccountId === parentId
    ? (parentAccount?.businessName || "My Account")
    : (childAccounts?.find(acc => acc.id === currentAccountId)?.business_name || "Account");

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between text-left font-normal"
          data-testid="button-account-switcher"
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <Users className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{currentAccountName}</span>
          </div>
          <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuLabel>Switch Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Parent Account */}
        <DropdownMenuItem
          onClick={() => {
            onSwitch(parentId, parentAccount?.businessName || "My Account");
            setIsOpen(false);
          }}
          className="cursor-pointer"
          data-testid={`account-option-${parentId}`}
        >
          <div className="flex items-center justify-between w-full">
            <span>{parentAccount?.businessName || "My Account"}</span>
            {currentAccountId === parentId && (
              <Check className="h-4 w-4" />
            )}
          </div>
        </DropdownMenuItem>

        {childAccounts && childAccounts.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-gray-500">Child Accounts</DropdownMenuLabel>
          </>
        )}

        {/* Child Accounts */}
        {childAccounts?.map((account) => (
          <DropdownMenuItem
            key={account.id}
            onClick={() => {
              onSwitch(account.id, account.business_name);
              setIsOpen(false);
            }}
            className="cursor-pointer"
            data-testid={`account-option-${account.id}`}
          >
            <div className="flex items-center justify-between w-full">
              <span>{account.business_name}</span>
              {currentAccountId === account.id && (
                <Check className="h-4 w-4" />
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
