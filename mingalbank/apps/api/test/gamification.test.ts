import { describe, expect, it } from "vitest";
import {
  applyStreakBonus,
  applyWeekendMultiplier,
  calculateTaskPoints,
  computeBadgeTier,
  computeNextStreak,
  getWeekRange,
  isWeekend,
} from "../src/modules/wallet/gamification";

// Fixed reference dates (UTC).
const MONDAY = new Date("2026-09-14T12:00:00.000Z"); // 2026-09-14 is a Monday
const SATURDAY = new Date("2026-09-19T09:00:00.000Z");
const SUNDAY = new Date("2026-09-20T09:00:00.000Z");

describe("isWeekend", () => {
  it("identifies Saturday and Sunday as weekend", () => {
    expect(isWeekend(SATURDAY)).toBe(true);
    expect(isWeekend(SUNDAY)).toBe(true);
  });

  it("identifies weekdays as not weekend", () => {
    expect(isWeekend(MONDAY)).toBe(false);
  });
});

describe("applyWeekendMultiplier", () => {
  it("leaves points untouched on a weekday", () => {
    expect(applyWeekendMultiplier(10, MONDAY)).toBe(10);
  });

  it("applies the 1.5x multiplier on Saturday", () => {
    expect(applyWeekendMultiplier(10, SATURDAY)).toBe(15);
  });

  it("applies the 1.5x multiplier on Sunday", () => {
    expect(applyWeekendMultiplier(10, SUNDAY)).toBe(15);
  });

  it("rounds to the nearest integer", () => {
    // 7 * 1.5 = 10.5 -> rounds to 11 (banker's rounding not used; Math.round)
    expect(applyWeekendMultiplier(7, SATURDAY)).toBe(11);
  });

  it("supports a custom multiplier", () => {
    expect(applyWeekendMultiplier(10, SATURDAY, 2)).toBe(20);
  });
});

describe("applyStreakBonus", () => {
  it("does not apply a bonus below the weekly threshold", () => {
    const result = applyStreakBonus(5, 10, 20, 0.1);
    expect(result).toEqual({ points: 5, bonusApplied: false });
  });

  it("applies +10% once the weekly total reaches the threshold", () => {
    const result = applyStreakBonus(10, 20, 20, 0.1);
    expect(result).toEqual({ points: 11, bonusApplied: true });
  });

  it("applies the bonus when the weekly total is already above the threshold", () => {
    const result = applyStreakBonus(10, 35, 20, 0.1);
    expect(result).toEqual({ points: 11, bonusApplied: true });
  });
});

describe("calculateTaskPoints", () => {
  it("combines weekend multiplier and streak bonus", () => {
    // 10 base points, weekend -> 15, weekly total already at 20 -> +10% -> 16.5 -> 17
    const result = calculateTaskPoints({
      basePoints: 10,
      completedAt: SATURDAY,
      weeklyPointsBeforeThisTask: 20,
    });
    expect(result.weekendBonusApplied).toBe(true);
    expect(result.streakBonusApplied).toBe(true);
    expect(result.finalPoints).toBe(17); // Math.round(15 * 1.1) = 17
  });

  it("applies neither bonus on a weekday with a low weekly total", () => {
    const result = calculateTaskPoints({
      basePoints: 10,
      completedAt: MONDAY,
      weeklyPointsBeforeThisTask: 0,
    });
    expect(result).toEqual({ finalPoints: 10, weekendBonusApplied: false, streakBonusApplied: false });
  });
});

describe("computeNextStreak", () => {
  it("starts a new streak at 1 on the first ever approval", () => {
    expect(computeNextStreak(0, null, MONDAY)).toBe(1);
  });

  it("does not increment twice for approvals on the same day", () => {
    const sameDayLater = new Date(MONDAY.getTime() + 3 * 60 * 60 * 1000);
    expect(computeNextStreak(1, MONDAY, sameDayLater)).toBe(1);
  });

  it("increments the streak for an approval on the very next day", () => {
    const nextDay = new Date("2026-09-15T08:00:00.000Z");
    expect(computeNextStreak(1, MONDAY, nextDay)).toBe(2);
  });

  it("resets the streak to 1 when a day is skipped", () => {
    const twoDaysLater = new Date("2026-09-16T08:00:00.000Z");
    expect(computeNextStreak(5, MONDAY, twoDaysLater)).toBe(1);
  });
});

describe("computeBadgeTier", () => {
  it("returns BRONZE below the SILVER threshold", () => {
    expect(computeBadgeTier(0)).toBe("BRONZE");
    expect(computeBadgeTier(499)).toBe("BRONZE");
  });

  it("returns SILVER at/above the SILVER threshold", () => {
    expect(computeBadgeTier(500)).toBe("SILVER");
    expect(computeBadgeTier(1999)).toBe("SILVER");
  });

  it("returns GOLD at/above the GOLD threshold", () => {
    expect(computeBadgeTier(2000)).toBe("GOLD");
    expect(computeBadgeTier(5000)).toBe("GOLD");
  });
});

describe("getWeekRange", () => {
  it("returns Monday 00:00:00.000 UTC through Sunday 23:59:59.999 UTC", () => {
    const { start, end } = getWeekRange(SATURDAY);
    expect(start.toISOString()).toBe("2026-09-14T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-20T23:59:59.999Z");
  });

  it("is stable regardless of which day within the week is passed in", () => {
    const fromMonday = getWeekRange(MONDAY);
    const fromSunday = getWeekRange(SUNDAY);
    expect(fromMonday.start.toISOString()).toBe(fromSunday.start.toISOString());
    expect(fromMonday.end.toISOString()).toBe(fromSunday.end.toISOString());
  });
});
