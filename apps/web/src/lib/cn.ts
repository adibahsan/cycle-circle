import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/** tailwind-merge that knows the project's custom radius/shadow tokens (rounded-panel, shadow-panel, shadow-soft). */
const twMerge = extendTailwindMerge({
  extend: { theme: { radius: ['panel'], shadow: ['panel', 'soft'] } },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
