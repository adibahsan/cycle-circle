'use client';
import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useHasMounted } from './useHasMounted';

interface RevealOnScrollProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  amount?: number;
}

export function RevealOnScroll({ children, className, delay = 0, y = 24, amount = 0.3 }: RevealOnScrollProps) {
  const reduce = useReducedMotion();
  const mounted = useHasMounted();
  if (mounted && reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
