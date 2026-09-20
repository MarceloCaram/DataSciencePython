/**
 * Family-wide gamification defaults. Mirrors GAMIFICATION_DEFAULTS in
 * packages/shared/domain.ts so the API and mobile app agree on the numbers
 * even though they aren't (yet) configurable per family in Fase 1.
 */
export const GAMIFICATION_DEFAULTS = {
  weekendMultiplier: 1.5,
  streakBonusThresholdPoints: 20,
  streakBonusPercent: 0.1,
  badgeThresholds: {
    BRONZE: 0,
    SILVER: 500,
    GOLD: 2000,
  },
} as const;

/**
 * Points → cash conversion rate used when a RedemptionRequest is approved.
 * Per the PRD ("Transformar 100 pontos em R$ 50"), 100 points = R$ 50.00,
 * i.e. R$ 0.50 per point. Kept as a single constant so it's easy to make
 * configurable per family later without touching call sites.
 */
export const POINTS_TO_CASH_RATE = 0.5;

export function pointsToCash(points: number): number {
  return Math.round(points * POINTS_TO_CASH_RATE * 100) / 100;
}
