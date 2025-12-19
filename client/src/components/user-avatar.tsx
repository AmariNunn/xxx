
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import skyiqLogo from "@assets/skyiq-logo_(1)_1766138528896.png";

interface UserAvatarProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function UserAvatar({ 
  size = "sm",
  className
}: UserAvatarProps) {
  const userId = localStorage.getItem('userId') || "";

  // Fetch business data including logo
  const { data: businessData } = useQuery({
    queryKey: ['/api/business', userId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/business/${userId}`);
      return response.json();
    }
  });

  // Get business name and logo from query data
  const businessName = businessData?.data?.businessName || "SkyIQ";
  const logoUrl = businessData?.data?.logoUrl;

  // Generate fallback initials from business name
  const getNameInitials = () => {
    if (!businessName) return "AC";
    const words = businessName.split(" ");
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
  };

  // Determine size class (20% larger)
  const sizeClass = {
    sm: "h-10 w-10",
    md: "h-12 w-12",
    lg: "h-20 w-20"
  }[size];

  return (
    <>
      {logoUrl ? (
        <Avatar className={`${sizeClass} ${className || ""}`}>
          <AvatarImage src={logoUrl} alt={businessName} />
          <AvatarFallback>{getNameInitials()}</AvatarFallback>
        </Avatar>
      ) : (
        <Avatar className={`${sizeClass} ${className || ""}`}>
          <AvatarImage src={skyiqLogo} alt="SkyIQ" className="object-contain p-1" />
          <AvatarFallback className="bg-primary text-white font-medium">{getNameInitials()}</AvatarFallback>
        </Avatar>
      )}
    </>
  );
}
