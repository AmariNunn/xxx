interface AudioWaveProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export default function AudioWave({ 
  className = "", 
  size = "md"
}: AudioWaveProps) {
  const sizeClasses = {
    sm: "audio-wave-sm",
    md: "",
    lg: "audio-wave-lg"
  };

  return (
    <div className={`audio-wave ${sizeClasses[size]} ${className}`}>
      <div className="audio-wave-bar"></div>
      <div className="audio-wave-bar"></div>
      <div className="audio-wave-bar"></div>
      <div className="audio-wave-bar"></div>
      <div className="audio-wave-bar"></div>
    </div>
  );
}