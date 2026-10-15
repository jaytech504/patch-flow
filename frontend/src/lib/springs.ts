/**
 * Apple Design Principles: Physics & Spring Tokens
 * Based on WWDC Designing Fluid Interfaces & Emil Kowalski's apple-design system.
 * 
 * Damping ratio:
 * - 1.0 = critically damped (zero bounce, calm, confident, no distraction)
 * - 0.8 = slight overshoot (only when flick/gesture momentum preceded it)
 * 
 * Response:
 * - Duration in seconds to reach target under unit mass
 */

export const appleSprings = {
  // Default UI transition: critically damped (damping 1.0, response 0.35s)
  default: {
    type: "spring" as const,
    bounce: 0,
    duration: 0.35,
  },

  // Snappy UI response for micro-interactions (presses, tabs, toggles)
  snappy: {
    type: "spring" as const,
    bounce: 0,
    duration: 0.24,
  },

  // Interactive momentum spring (damping ~0.8, response 0.38s)
  // Use for flick releases, drag handoffs, cards
  momentum: {
    type: "spring" as const,
    bounce: 0.18,
    duration: 0.38,
  },

  // Sheet, drawer, and modal enter/exit
  sheet: {
    type: "spring" as const,
    bounce: 0.12,
    duration: 0.34,
  },

  // Anchored popover / dropdown menu
  popover: {
    type: "spring" as const,
    bounce: 0.05,
    duration: 0.28,
  },

  // Reduced motion accessible fallback (clean crossfade)
  reducedMotion: {
    type: "tween" as const,
    duration: 0.16,
    ease: [0.16, 1, 0.3, 1] as const,
  },
} as const;

/**
 * Exponential decay momentum projection (Apple physics formula)
 * Projects where a gesture will naturally land given its release velocity.
 */
export function projectMomentum(
  initialVelocity: number /* px/s */,
  decelerationRate: number = 0.998
): number {
  return (initialVelocity / 1000) * decelerationRate / (1 - decelerationRate);
}

/**
 * Progressive rubber-band resistance at scroll/drag boundaries
 */
export function rubberband(
  overshoot: number,
  dimension: number,
  constant: number = 0.55
): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
