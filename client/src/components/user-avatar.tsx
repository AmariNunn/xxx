import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserAvatarProps {
  logoUrl?: string;
  businessName?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function UserAvatar({ 
  logoUrl, 
  businessName = "AI Call",
  size = "sm",
  className
}: UserAvatarProps) {
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

  // Use a local storage image if available (our placeholder until backend fully implemented)
  const [localLogo, setLocalLogo] = useState<string | null>(null);
  
  useEffect(() => {
    // Check local storage for a saved logo
    const savedLogo = localStorage.getItem("business-logo");
    if (savedLogo) {
      setLocalLogo(savedLogo);
    }
  }, []);

  // Use provided logoUrl first, then localLogo, or default to avatar fallback
  const imageUrl = logoUrl || localLogo;

  return (
    <>
      {imageUrl ? (
        <Avatar className={`${sizeClass} ${className || ""}`}>
          <AvatarImage src={imageUrl} alt={businessName} />
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