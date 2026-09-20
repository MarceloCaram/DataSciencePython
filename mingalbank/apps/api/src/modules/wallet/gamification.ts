/**
 * Pure, dependency-free gamification rules used by the tasks/wallet modules.
 * Kept isolated from Prisma/Express so they're trivial to unit test (see
 * apps/api/test/gamification.test.ts).
 */
import { GAMIFICATION_DEFAULTS } from "./constants";
import type { BadgeTier } from "@prisma/client";

/** Sunday = 0 ... Saturday = 6 (JS Date#getUTCDay convention). */
export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Applies the 1.5x weekend multiplier to a task's base points when the
 * completion falls on a Saturday or Sunday (UTC). Result is rounded to the
 * nearest integer since points are whole numbers.
 */
export function applyWeekendMultiplier(
  basePoints: number,
  completedAt: Date,
  multiplier: number = GAMIFICATION_DEFAULTS.weekendMultiplier,
): number {
  if (!isWeekend(completedAt)) {
    return basePoints;
  }
  return Math.round(basePoints * multiplier);
}

export interface StreakBonusResult {
  points: number;
  bonusApplied: boolean;
}

/**
 * Streak bonus rule: "+10% a cada semana com mais de 20 pontos" (PRD §4).
 * Interpreted as — once the child's running total of task points earned
 * *this week* (Mon–Sun) reaches the threshold (20 by default), every task
 * approved for the remainder of that week earns an extra +10% on top of its
 * (already weekend-adjusted) points.
 *
 * This is a pure function: the caller is responsible for computing
 * `weeklyPointsBeforeThisTask` (sum of TASK_REWARD points already credited
 * this week, before this task) from persisted data.
 */
export function applyStreakBonus(
  points: number,
  weeklyPointsBeforeThisTask: number,
  thresholdPoints: number = GAMIFICATION_DEFAULTS.streakBonusThresholdPoints,
  bonusPercent: number = GAMIFICATION_DEFAULTS.streakBonusPercent,
): StreakBonusResult {
  const alreadyOverThreshold = weeklyPointsBeforeThisTask >= thresholdPoints;
  if (!alreadyOverThreshold) {
    return { points, bonusApplied: false };
  }
  return { points: Math.round(points * (1 + bonusPercent)), bonusApplied: true };
}

export interface TaskPointsInput {
  basePoints: number;
  completedAt: Date;
  weeklyPointsBeforeThisTask: number;
  weekendMultiplier?: number;
  streakBonusThresholdPoints?: number;
  streakBonusPercent?: number;
}

export interface TaskPointsResult {
  finalPoints: number;
  weekendBonusApplied: boolean;
  streakBonusApplied: boolean;
}

/**
 * Combines the weekend multiplier and the streak bonus to compute the final
 * points a child earns for one approved task completion.
 */
export function calculateTaskPoints(input: TaskPointsInput): TaskPointsResult {
  const weekendAdjusted = applyWeekendMultiplier(
    input.basePoints,
    input.completedAt,
    input.weekendMultiplier,
  );
  const { points: finalPoints, bonusApplied: streakBonusApplied } = applyStreakBonus(
    weekendAdjusted,
    input.weeklyPointsBeforeThisTask,
    input.streakBonusThresholdPoints,
    input.streakBonusPercent,
  );

  return {
    finalPoints,
    weekendBonusApplied: weekendAdjusted !== input.basePoints,
    streakBonusApplied,
  };
}

function toUtcDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function diffInCalendarDays(a: Date, b: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((toUtcDayStart(a).getTime() - toUtcDayStart(b).getTime()) / MS_PER_DAY);
}

/**
 * Streak rule: a child's streak counts consecutive calendar days (UTC) with
 * at least one approved task.
 *   - First ever approval: streak becomes 1.
 *   - Another approval on the same day the streak was last updated: no change
 *     (a day only counts once, no matter how many tasks are approved on it).
 *   - Approval exactly one day after the last one: streak increments by 1.
 *   - Approval more than one day after the last one (a day was skipped):
 *     the streak was broken, so it resets and restarts at 1 for today.
 */
export function computeNextStreak(currentStreak: number, lastApprovedDate: Date | null, approvedAt: Date): number {
  if (!lastApprovedDate) {
    return 1;
  }

  const gap = diffInCalendarDays(approvedAt, lastApprovedDate);

  if (gap <= 0) {
    // Same day (or a clock skew putting it before) — streak already counted.
    return currentStreak || 1;
  }
  if (gap === 1) {
    return currentStreak + 1;
  }
  // gap > 1: at least one full day with no approval in between.
  return 1;
}

export interface WeekRange {
  start: Date;
  end: Date;
}

/**
 * Monday 00:00:00.000 UTC through Sunday 23:59:59.999 UTC of the week
 * containing `date`. Used to sum up "points earned this week" for the
 * streak bonus rule.
 */
export function getWeekRange(date: Date): WeekRange {
  const dayStart = toUtcDayStart(date);
  // getUTCDay(): Sunday = 0 ... Saturday = 6. Convert to Monday-first offset.
  const isoWeekday = dayStart.getUTCDay() === 0 ? 7 : dayStart.getUTCDay();
  const start = new Date(dayStart);
  start.setUTCDate(start.getUTCDate() - (isoWeekday - 1));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);
  return { start, end };
}

/**
 * Badge tier derived from the child's current points balance, per the
 * BRONZE/SILVER/GOLD thresholds in GAMIFICATION_DEFAULTS.badgeThresholds.
 */
export function computeBadgeTier(
  pointsBalance: number,
  thresholds: typeof GAMIFICATION_DEFAULTS.badgeThresholds = GAMIFICATION_DEFAULTS.badgeThresholds,
): BadgeTier {
  if (pointsBalance >= thresholds.GOLD) return "GOLD";
  if (pointsBalance >= thresholds.SILVER) return "SILVER";
  return "BRONZE";
}
