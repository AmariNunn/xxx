import { ReactNode, useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import UserAvatar from "@/components/user-avatar";
import { Phone, Users, Building, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

interface UserLayoutProps {
  children: ReactNode;
}

export default function UserLayout({ children }: UserLayoutProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>("");
  const [, setLocation] = useLocation();
  const { userId, logout } = useAuth();

  // Load user's business data to get the logo
  useEffect(() => {
    const fetchBusinessData = async () => {
      try {
        if (!userId) return;
        
        const response = await fetch(`/api/business/${userId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.data?.logoUrl) {
            setLogoUrl(data.data.logoUrl);
          }
          if (data.data?.businessName) {
            setBusinessName(data.data.businessName);
          }
        }
      } catch (error) {
        console.error("Error fetching logo:", error);
      }
    };

    fetchBusinessData();
  }, [userId]);

  const handleLogout = () => {
    // Clear all authentication data
    localStorage.removeItem('userId');
    localStorage.removeItem('userEmail');
    
    // Force redirect to login page
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top navigation bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Logo area */}
            <div className="flex items-center">
              {logoUrl ? (
                <div className="h-8 w-8 rounded-md overflow-hidden flex-shrink-0">
                  <img 
                    src={logoUrl} 
                    alt={businessName || "Company Logo"} 
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-8 w-8 bg-primary rounded-md flex items-center justify-center text-white text-lg font-semibold">
                  {businessName ? businessName[0] : 'A'}
                </div>
              )}
              <span className="ml-2 font-semibold text-textColor truncate max-w-[120px] md:max-w-xs">
                {businessName || "My Account"}
              </span>
            </div>
          </div>

          {/* User menu */}
          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogout}
              className="flex items-center gap-1"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>
            <UserAvatar size="sm" />
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="container mx-auto px-4 py-6">
        {children}
      </div>
    </div>
  );
}