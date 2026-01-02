import { useState, useEffect, useCallback, useRef } from "react";

interface TypewriterOptions {
  phrases: string[];
  typeSpeed?: number;
  deleteSpeed?: number;
  pauseDuration?: number;
  loop?: boolean;
}

export function useTypewriter({
  phrases,
  typeSpeed = 100,
  deleteSpeed = 50,
  pauseDuration = 2000,
  loop = true,
}: TypewriterOptions) {
  const [displayText, setDisplayText] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null);

  const tick = useCallback(() => {
    const currentPhrase = phrases[phraseIndex];
    
    if (isPaused) {
      return;
    }

    if (isDeleting) {
      setDisplayText(currentPhrase.substring(0, displayText.length - 1));
      
      if (displayText.length === 0) {
        setIsDeleting(false);
        setPhraseIndex((prev) => (prev + 1) % phrases.length);
      }
    } else {
      setDisplayText(currentPhrase.substring(0, displayText.length + 1));
      
      if (displayText.length === currentPhrase.length) {
        if (loop || phraseIndex < phrases.length - 1) {
          setIsPaused(true);
          
          if (pauseTimerRef.current) {
            clearTimeout(pauseTimerRef.current);
          }
          
          pauseTimerRef.current = setTimeout(() => {
            setIsPaused(false);
            setIsDeleting(true);
          }, pauseDuration);
        }
      }
    }
  }, [displayText, isDeleting, isPaused, phraseIndex, phrases, loop, pauseDuration]);

  useEffect(() => {
    if (isPaused) return;
    
    const speed = isDeleting ? deleteSpeed : typeSpeed;
    const timer = setTimeout(tick, speed);
    
    return () => clearTimeout(timer);
  }, [tick, isDeleting, isPaused, typeSpeed, deleteSpeed]);

  useEffect(() => {
    return () => {
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
      }
    };
  }, []);

  return { displayText, isTyping: !isDeleting && displayText.length < phrases[phraseIndex]?.length };
}
