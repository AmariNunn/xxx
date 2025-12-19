interface VoxIntelTextProps {
  className?: string;
}

export default function VoxIntelText({ className = "" }: VoxIntelTextProps) {
  const letters = ['S', 'k', 'y', 'I', 'Q'];

  return (
    <span className={`voxintel-text ${className}`}>
      {letters.map((letter, index) => (
        <span key={index}>{letter}</span>
      ))}
    </span>
  );
}