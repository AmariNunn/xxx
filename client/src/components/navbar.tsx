import { Link, useLocation } from "wouter";
import { Phone, LayoutDashboard, FileText, Building2, Bot, Users, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavbarProps {
  onLogout?: () => void;
}

export default function Navbar({ onLogout }: NavbarProps) {
  const [location] = useLocation();

  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/call-dashboard", label: "Call History", icon: Phone },
    { path: "/bulk-caller", label: "Bulk Caller", icon: Users },
    { path: "/skyiq-agent", label: "AI Agent", icon: Bot },
    { path: "/call-review", label: "Call Review", icon: FileText },
    { path: "/business-profile", label: "Business Profile", icon: Building2 },
  ];

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/dashboard">
            <div className="flex items-center gap-2 font-bold text-xl hover:opacity-80 transition-opacity cursor-pointer" data-testid="link-logo">
              <Phone className="h-6 w-6 text-primary" />
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                SkyIQ
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              
              return (
                <Link key={item.path} href={item.path}>
                  <div
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                    data-testid={`link-${item.path.replace('/', '')}`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Logout Button */}
          {onLogout && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="gap-2"
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          )}
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden pb-3 flex gap-2 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            
            return (
              <Link key={item.path} href={item.path}>
                <div
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                  data-testid={`link-mobile-${item.path.replace('/', '')}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
