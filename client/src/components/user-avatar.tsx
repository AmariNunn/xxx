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
    sm: "h-11 w-11",
    md: "h-14 w-14",
    lg: "h-[88px] w-[88px]"
  }[size];

  return (
    <img 
      src={skyiqLogo} 
      alt="SkyIQ" 
      className={`${sizeClass} object-contain ${className || ""}`}
    />
  );
}
