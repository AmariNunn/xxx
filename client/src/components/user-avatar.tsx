
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserAvatarProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function UserAvatar({ 
  size = "sm",
  className
}: UserAvatarProps) {
  const userId = Number(localStorage.getItem('userId')) || 1;

  // Fetch business data including logo
  const { data: businessData } = useQuery({
    queryKey: ['/api/business', userId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/business/${userId}`);
      return response.json();
    }
  });

  // Get business name and logo from query data
  const businessName = businessData?.data?.businessName || "VoxIntel";
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

  // Determine size class
  const sizeClass = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-16 w-16"
  }[size];

  return (
    <>
      {logoUrl ? (
        <Avatar className={`${sizeClass} ${className || ""}`}>
          <AvatarImage src={logoUrl} alt={businessName} />
          <AvatarFallback>{getNameInitials()}</AvatarFallback>
        </Avatar>
      ) : (
        <div className={`${sizeClass} rounded-full bg-primary flex items-center justify-center text-white font-medium ${className || ""}`}>
          {getNameInitials()}
        </div>
      )}
    </>
  );
}
