interface VoxIntelTextProps {
  className?: string;
}

export default function VoxIntelText({ className = "" }: VoxIntelTextProps) {
  const letters = ['V', 'o', 'x', 'I', 'n', 't', 'e', 'l'];

  return (
    <span className={`voxintel-text ${className}`}>
      {letters.map((letter, index) => (
        <span key={index}>{letter}</span>
      ))}
    </span>
  );
}