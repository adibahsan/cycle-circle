'use client';

import { motion, useReducedMotion } from 'motion/react';

interface VestaLogoProps {
  size?: number;
  animate?: boolean;
  className?: string;
}

const GRADIENT_ID_STATIC = 'vesta-logo-gradient-static';
const GRADIENT_ID_CRESCENT = 'vesta-logo-gradient-crescent';

/** Pure SVG logo — no animation. */
export function VestaLogoSVG({ size = 32, className }: Omit<VestaLogoProps, 'animate'>) {
  // Unique IDs per instance to avoid SVG gradient collisions when rendered multiple times
  const uid = Math.random().toString(36).slice(2, 7);
  const gradId = `${GRADIENT_ID_STATIC}-${uid}`;
  const crescentId = `${GRADIENT_ID_CRESCENT}-${uid}`;

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
        {/* Primary gradient: Deep Rose → Lavender */}
        <linearGradient id={gradId} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E8476C" />
          <stop offset="100%" stopColor="#9B7FD4" />
        </linearGradient>
        {/* Soft radial for crescent glow */}
        <radialGradient id={crescentId} cx="50%" cy="30%" r="60%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="white" stopOpacity="0.95" />
          <stop offset="100%" stopColor="white" stopOpacity="0.55" />
        </radialGradient>
      </defs>

      {/*
        Stylised V shape built from two flowing petal curves.
        Left arm: sweeps down-left from the top centre, curves into the bottom tip.
        Right arm: mirrors it, curving up-right back to the top centre.
        The result is an elegant teardrop "V" silhouette.
      */}
      <path
        d={[
          /* Left petal arm */
          'M24 5',
          'C18 5, 10 12, 8 22',
          'C6 30, 12 40, 24 44',
          /* Right petal arm */
          'C36 40, 42 30, 40 22',
          'C38 12, 30 5, 24 5',
          'Z',
        ].join(' ')}
        fill={`url(#${gradId})`}
      />

      {/*
        Inner crescent moon — sits in the upper-centre of the V.
        Two overlapping circles whose difference forms a crescent.
        Achieved with a clipping path so we only keep the sliver.
      */}
      <circle
        cx="24"
        cy="19"
        r="7.5"
        fill={`url(#${crescentId})`}
        opacity="0.92"
      />
      {/* Occluder circle that carves out the crescent shadow */}
      <circle
        cx="27"
        cy="17"
        r="6"
        fill={`url(#${gradId})`}
        opacity="0.75"
      />

      {/*
        Small teardrop accent dot at the bottom tip — echoes fertility symbolism
        and grounds the overall shape.
      */}
      <circle
        cx="24"
        cy="40"
        r="2.2"
        fill="white"
        opacity="0.8"
      />
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
