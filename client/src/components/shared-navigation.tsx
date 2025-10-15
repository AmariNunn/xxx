import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  Phone, 
  ArrowRightFromLine, 
  LogOut, 
  Home,
  Building,
  Bot,
  Shield,
} from "lucide-react";
import AudioWave from "@/components/audio-wave";
import SkyIQText from "@/components/skyiq-text";
import { Button } from "@/components/ui/button";

interface SharedNavigationProps {
  currentPath: string;
  onLogout: () => void;
  className?: string;
}

export default function SharedNavigation({ 
  currentPath, 
  onLogout, 
  className = "" 
}: SharedNavigationProps) {
  const [, setLocation] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (userId) {
      fetch(`/api/admin/check/${userId}`)
        .then(res => res.json())
        .then(data => setIsAdmin(data.isAdmin || false))
        .catch(() => setIsAdmin(false));
    }
  }, [currentPath]);

  const navigationItems = [
    {
      path: "/dashboard",
      icon: Home,
      label: "Home",
      onClick: () => setLocation('/dashboard')
    },
    {
      path: "/call-dashboard", 
      icon: Phone,
      label: "Call Dashboard",
      onClick: () => setLocation('/call-dashboard')
    },
    {
      path: "/skyiq-agent",
      icon: Bot,
      label: "SkyIQ AI Agent", 
      onClick: () => setLocation('/skyiq-agent')
    },
    {
      path: "/business-profile",
      icon: Building,
      label: "Business Profile",
      onClick: () => setLocation('/business-profile')
    },
    ...(isAdmin ? [{
      path: "/admin",
      icon: Shield,
      label: "Admin",
      onClick: () => setLocation('/admin')
    }] : [])
  ];

  const isActivePath = (path: string) => {
    return currentPath === path;
  };

  return (
    <>
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-lg transform ${
          isMobile ? (isSidebarOpen ? "translate-x-0" : "-translate-x-full") : "translate-x-0"
        } transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${className}`}
      >
        <div className="flex flex-col h-full">
          <div className="px-4 py-6 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-2xl font-bold text-primary flex items-center gap-3">
              <Phone className="h-6 w-6" />
              SkyIQ AI Voice Agent
              <AudioWave size="sm" className="text-blue-600" />
            </h1>
          </div>

          <nav className="flex-1 px-2 py-4 space-y-1">
            {navigationItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = isActivePath(item.path);
              
              return (
                <Button
                  key={item.path}
                  variant={isActive ? "secondary" : "ghost"}
                  className="w-full justify-start text-left font-normal hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={item.onClick}
                >
                  <IconComponent className="mr-3 h-5 w-5" />
                  {item.label}
                </Button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="ghost"
              className="w-full justify-start text-left font-normal text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={onLogout}
            >
              <LogOut className="mr-3 h-5 w-5" />
              Log Out
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile sidebar toggle */}
      {isMobile && (
        <button
          className="fixed bottom-4 right-4 z-50 bg-primary text-white p-3 rounded-full shadow-lg"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <ArrowRightFromLine className={`h-6 w-6 transform ${isSidebarOpen ? "rotate-180" : ""}`} />
        </button>
      )}
    </>
  );
}