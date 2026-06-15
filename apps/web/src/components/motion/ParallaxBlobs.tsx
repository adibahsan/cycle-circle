'use client';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';

interface ParallaxBlobsProps {
  className?: string;
}

export function ParallaxBlobs({ className }: ParallaxBlobsProps) {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -40]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 30]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -25]);

  return (
    <div aria-hidden="true" className={className ?? 'pointer-events-none absolute inset-0 -z-10 overflow-hidden'}>
      <motion.div
        style={{ y: reduce ? 0 : y1, background: 'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)', filter: 'blur(60px)' }}
        className="absolute -top-24 -left-24 h-[28rem] w-[28rem] rounded-full opacity-25"
      />
      <motion.div
        style={{ y: reduce ? 0 : y2, background: 'radial-gradient(circle, var(--color-secondary) 0%, transparent 70%)', filter: 'blur(60px)' }}
        className="absolute top-1/3 -right-24 h-[26rem] w-[26rem] rounded-full opacity-20"
      />
      <motion.div
        style={{ y: reduce ? 0 : y3, background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 70%)', filter: 'blur(60px)' }}
        className="absolute bottom-0 left-1/4 h-[24rem] w-[24rem] rounded-full opacity-20"
      />
    </div>
  );
}
