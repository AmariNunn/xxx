import skyiqLogo from "@assets/skyiq-logo_(1)_1766138953915.png";

interface UserAvatarProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function UserAvatar({ 
  size = "sm",
  className
}: UserAvatarProps) {
  const sizeClass = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-16 w-16"
  }[size];

  return (
    <img 
      src={skyiqLogo} 
      alt="SkyIQ" 
      className={`${sizeClass} object-contain ${className || ""}`}
    />
  );
}
