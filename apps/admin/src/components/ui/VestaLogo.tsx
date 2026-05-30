'use client';

import { useId } from 'react';

interface VestaLogoProps {
  size?: number;
  animate?: boolean;
  className?: string;
}

/** Pure SVG logo — rounded square with gradient and bold "V". */
export function VestaLogoSVG({ size = 32, className }: Omit<VestaLogoProps, 'animate'>) {
  const uid = useId();
  const gradId = `vesta-logo-gradient-${uid}`;

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

/** Animated version of the logo — gentle breathing / pulse effect using CSS. */
export function VestaLogoAnimated({ size = 32, className }: Omit<VestaLogoProps, 'animate'>) {
  return (
    <span
      className={`inline-flex animate-breathe ${className ?? ''}`}
      style={{ lineHeight: 0 }}
    >
      <VestaLogoSVG size={size} />
    </span>
  );
}

/** Default export — picks the animated or static variant based on the `animate` prop. */
export default function VestaLogo({ size = 32, animate = false, className }: VestaLogoProps) {
  if (animate) {
    return <VestaLogoAnimated size={size} className={className} />;
  }
  return <VestaLogoSVG size={size} className={className} />;
}
