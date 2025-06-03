interface SkyIQTextProps {
  className?: string;
}

export default function SkyIQText({ className = "" }: SkyIQTextProps) {
  const letters = ['S', 'k', 'y', ' ', 'I', 'Q'];

  return (
    <span className={`skyiq-text ${className}`}>
      {letters.map((letter, index) => (
        <span key={index}>{letter}</span>
      ))}
    </span>
  );
}