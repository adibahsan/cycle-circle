'use client';

import { motion, useReducedMotion } from 'motion/react';

interface VestaLogoProps {
  size?: number;
  animate?: boolean;
  className?: string;
}

/** Cycle Circle drop mark: brand-red drop on a navy disc. */
export function VestaLogoSVG({ size = 32, className }: Omit<VestaLogoProps, 'animate'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-label="Cycle Circle"
      role="img"
      className={className}
    >
      <circle cx="24" cy="24" r="23.25" style={{ fill: 'var(--color-brand-navy)' }} stroke="#FFFFFF" strokeOpacity="0.22" strokeWidth="1.5" />
      <path d="M24 9.5C24 9.5 14.5 21.6 14.5 28.6A9.5 9.5 0 0 0 33.5 28.6C33.5 21.6 24 9.5 24 9.5Z" style={{ fill: 'var(--color-brand-red)' }} />
    </svg>
  );
}

/** Animated version of the logo — gentle breathing / pulse effect. */
export function VestaLogoAnimated({ size = 32, className }: Omit<VestaLogoProps, 'animate'>) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      animate={prefersReducedMotion ? undefined : { scale: [1, 1.06, 1] }}
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      style={{ display: 'inline-flex', lineHeight: 0 }}
      className={className}
    >
      <VestaLogoSVG size={size} />
    </motion.div>
  );
}

/** Default export — picks the animated or static variant based on the `animate` prop. */
export default function VestaLogo({ size = 32, animate = false, className }: VestaLogoProps) {
  if (animate) {
    return <VestaLogoAnimated size={size} className={className} />;
  }
  return <VestaLogoSVG size={size} className={className} />;
}
