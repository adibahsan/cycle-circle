'use client';

import { motion, useReducedMotion } from 'motion/react';

interface VestaLogoProps {
  size?: number;
  animate?: boolean;
  className?: string;
}

const GRADIENT_ID = 'vesta-logo-gradient';

/** Pure SVG logo — rounded square with gradient and bold "V". */
export function VestaLogoSVG({ size = 32, className }: Omit<VestaLogoProps, 'animate'>) {
  const uid = Math.random().toString(36).slice(2, 7);
  const gradId = `${GRADIENT_ID}-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-label="Vesta logo"
      role="img"
      className={className}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E8476C" />
          <stop offset="100%" stopColor="#9B7FD4" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill={`url(#${gradId})`} />
      <text
        x="24"
        y="33"
        textAnchor="middle"
        fontFamily="var(--font-display), system-ui, sans-serif"
        fontWeight="700"
        fontSize="28"
        fill="white"
      >
        V
      </text>
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
