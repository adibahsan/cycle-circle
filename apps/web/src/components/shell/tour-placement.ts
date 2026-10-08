/** Where the onboarding tour card goes on phones: never over the bottom nav or the spotlit target. */

export interface RectLike {
  top: number
  bottom: number
  left: number
  right: number
  width: number
  height: number
}

export interface TourPlacementInput {
  viewportWidth: number
  viewportHeight: number
  /** Viewport y of the bottom nav's top edge (viewportHeight when there is no nav). */
  navTop: number
  target: RectLike | null
  spotlightPadding?: number
  cardHeight?: number
  margin?: number
}

export interface TourPlacement {
  left: number
  right: number
  top?: number
  bottom?: number
}

export function tourCardPlacement({
  viewportWidth,
  viewportHeight,
  navTop,
  target,
  spotlightPadding = 8,
  cardHeight = 240,
  margin = 16,
}: TourPlacementInput): TourPlacement {
  const sides = { left: margin, right: margin }
  void viewportWidth
  const spotTop = target ? target.top - spotlightPadding : 0
  const spotBottom = target ? target.bottom + spotlightPadding : 0

  // Target lives in the nav: card floats above its spotlight.
  if (target && target.top >= navTop - spotlightPadding) {
    return { ...sides, bottom: viewportHeight - spotTop + 12 }
  }

  // Default: a bottom card whose lower edge clears the nav.
  const bottomEdge = navTop - margin
  const cardTop = bottomEdge - cardHeight
  if (target && spotBottom > cardTop) {
    return { ...sides, top: margin }
  }
  return { ...sides, bottom: viewportHeight - bottomEdge }
}
