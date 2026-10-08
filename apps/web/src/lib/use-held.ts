import { useRef } from 'react'

/**
 * Returns `value` while it is non-null, and the last non-null value after it becomes null.
 * Lets a pop-up keep rendering its content while the shell plays the exit animation.
 */
export function useHeld<T>(value: T | null): T | null {
  const ref = useRef<T | null>(value)
  if (value !== null) ref.current = value
  return ref.current
}
