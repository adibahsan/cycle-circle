import { Droplet, Flower2, Moon, Sprout, type LucideProps } from 'lucide-react';
import type { CyclePhase } from '@vesta/shared/types';

const PHASE_ICONS = {
  menstrual: Droplet,
  follicular: Sprout,
  ovulation: Flower2,
  luteal: Moon,
} as const;

/** Drawn icon for a cycle phase (replaces the old phase emoji). Decorative by default. */
export function PhaseIcon({ phase, size = 16, ...props }: { phase: CyclePhase } & LucideProps) {
  const Icon = PHASE_ICONS[phase];
  return <Icon size={size} strokeWidth={2} aria-hidden="true" style={{ color: `var(--color-${phase})` }} {...props} />;
}

type Flow = 'light' | 'medium' | 'heavy';
const FLOW_DROPS: Record<Flow, number> = { light: 1, medium: 2, heavy: 3 };

/** Flow intensity as 1–3 filled drops (replaces 💧 🩸 🌊). Decorative: pair it with the text label. */
export function FlowIcon({ flow, size = 12, className }: { flow: Flow | string; size?: number; className?: string }) {
  const n = FLOW_DROPS[(flow?.toLowerCase?.() as Flow)] ?? 1;
  return (
    <span aria-hidden="true" className={['inline-flex items-center -space-x-0.5', className].filter(Boolean).join(' ')}>
      {Array.from({ length: n }, (_, i) => (
        <Droplet key={i} size={size} strokeWidth={2} fill="currentColor" />
      ))}
    </span>
  );
}
