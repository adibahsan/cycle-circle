'use client';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import { useHasMounted } from './useHasMounted';

interface SplitWordsProps {
  text: string;
  className?: string;
  wordClassName?: string;
  startDelay?: number;
  staggerDelay?: number;
}

export function SplitWords({ text, className, wordClassName, startDelay = 0, staggerDelay = 0.06 }: SplitWordsProps) {
  const reduce = useReducedMotion();
  const mounted = useHasMounted();
  if (mounted && reduce) return <span className={className}>{text}</span>;

  const words = text.split(' ');
  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: staggerDelay, delayChildren: startDelay } },
  };
  const word: Variants = {
    hidden: { opacity: 0, y: '0.4em' },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <motion.span className={className} variants={container} initial="hidden" animate="show" style={{ display: 'block' }}>
      {words.map((w, i) => (
        <span key={i}>
          <motion.span variants={word} className={wordClassName} style={{ display: 'inline-block' }}>
            {w}
          </motion.span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </motion.span>
  );
}
