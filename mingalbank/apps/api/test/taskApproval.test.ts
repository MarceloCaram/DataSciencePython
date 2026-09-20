import { beforeEach, describe, expect, it } from "vitest";
import { AppError } from "../src/lib/errors";
import {
  reviewTaskCompletion,
  type ChildRecord,
  type TaskApprovalDeps,
  type TaskCompletionRecord,
} from "../src/modules/tasks/taskApproval.service";

const FAMILY_ID = "family-1";
const PARENT_ID = "parent-1";
const CHILD_ID = "child-1";
const TASK_ID = "task-1";

/** Minimal in-memory fake of the Prisma-backed dependencies, so the review
 * flow (including its side effects) can be exercised without a real DB. */
function createFakeDeps(overrides?: {
  completion?: Partial<TaskCompletionRecord>;
  child?: Partial<ChildRecord>;
  weeklyPoints?: number;
  weekendMultiplier?: number;
}) {
  const completion: TaskCompletionRecord = {
    id: "completion-1",
    taskId: TASK_ID,
    childId: CHILD_ID,
    status: "PENDING",
    evidenceUrl: null,
    completedAt: new Date("2026-09-14T10:00:00.000Z"),
    reviewedAt: null,
    reviewedByParentId: null,
    task: { id: TASK_ID, familyId: FAMILY_ID, childId: CHILD_ID, points: 10 },
    ...overrides?.completion,
  };

  const child: ChildRecord = {
    id: CHILD_ID,
    familyId: FAMILY_ID,
    pointsBalance: 0,
    currentStreak: 0,
    lastApprovedDate: null,
    badgeTier: "BRONZE",
    ...overrides?.child,
  };

  const state = { completion, child, weeklyPoints: overrides?.weeklyPoints ?? 0 };
  const approvalCalls: unknown[] = [];
  const rejectionCalls: unknown[] = [];

  const deps: TaskApprovalDeps = {
    async findCompletion(completionId, taskId) {
      if (state.completion.id !== completionId || state.completion.taskId !== taskId) return null;
      return state.completion;
    },
    async findChild(childId) {
      if (state.child.id !== childId) return null;
      return state.child;
    },
    async findFamily(familyId) {
      if (familyId !== FAMILY_ID) return null;
      return { weekendMultiplier: overrides?.weekendMultiplier ?? 1.5 };
    },
    async sumWeeklyTaskRewardPoints() {
      return state.weeklyPoints;
    },
    async applyApproval(input) {
      approvalCalls.push(input);
      state.completion = { ...state.completion, status: "APPROVED", reviewedAt: input.reviewedAt, reviewedByParentId: input.reviewedByParentId };
      state.child = {
        ...state.child,
        pointsBalance: input.newPointsBalance,
        currentStreak: input.nextStreak,
        lastApprovedDate: input.reviewedAt,
        badgeTier: input.newBadgeTier,
      };
    },
    async applyRejection(input) {
      rejectionCalls.push(input);
      state.completion = { ...state.completion, status: "REJECTED", reviewedAt: input.reviewedAt, reviewedByParentId: input.reviewedByParentId };
    },
  };

  return { deps, state, approvalCalls, rejectionCalls };
}

describe("reviewTaskCompletion", () => {
  it("rejects a completion without touching points/streak", async () => {
    const { deps, state, rejectionCalls } = createFakeDeps();

    const result = await reviewTaskCompletion(deps, {
      taskId: TASK_ID,
      completionId: "completion-1",
      familyId: FAMILY_ID,
      parentId: PARENT_ID,
      approve: false,
      now: new Date("2026-09-14T12:00:00.000Z"),
    });

    expect(result.status).toBe("REJECTED");
    expect(state.completion.status).toBe("REJECTED");
    expect(state.child.pointsBalance).toBe(0);
    expect(rejectionCalls).toHaveLength(1);
  });

  it("approves a weekday completion crediting base points and starting a streak", async () => {
    const { deps, state } = createFakeDeps();
    const now = new Date("2026-09-14T12:00:00.000Z"); // Monday

    const result = await reviewTaskCompletion(deps, {
      taskId: TASK_ID,
      completionId: "completion-1",
      familyId: FAMILY_ID,
      parentId: PARENT_ID,
      approve: true,
      now,
    });

    expect(result).toMatchObject({
      status: "APPROVED",
      pointsAwarded: 10,
      weekendBonusApplied: false,
      streakBonusApplied: false,
      nextStreak: 1,
      newPointsBalance: 10,
      newBadgeTier: "BRONZE",
    });
    expect(state.child.pointsBalance).toBe(10);
    expect(state.child.currentStreak).toBe(1);
    expect(state.child.lastApprovedDate).toEqual(now);
  });

  it("applies the weekend multiplier and continues an existing streak", async () => {
    const { deps, state } = createFakeDeps({
      child: { pointsBalance: 50, currentStreak: 3, lastApprovedDate: new Date("2026-09-18T10:00:00.000Z") },
    });
    const now = new Date("2026-09-19T10:00:00.000Z"); // Saturday, day after lastApprovedDate

    const result = await reviewTaskCompletion(deps, {
      taskId: TASK_ID,
      completionId: "completion-1",
      familyId: FAMILY_ID,
      parentId: PARENT_ID,
      approve: true,
      now,
    });

    expect(result.weekendBonusApplied).toBe(true);
    expect(result.pointsAwarded).toBe(15); // 10 * 1.5
    expect(result.nextStreak).toBe(4);
    expect(state.child.pointsBalance).toBe(65);
  });

  it("uses the family's configured weekend multiplier instead of the hardcoded 1.5x", async () => {
    const { deps } = createFakeDeps({ weekendMultiplier: 2 });
    const now = new Date("2026-09-19T10:00:00.000Z"); // Saturday

    const result = await reviewTaskCompletion(deps, {
      taskId: TASK_ID,
      completionId: "completion-1",
      familyId: FAMILY_ID,
      parentId: PARENT_ID,
      approve: true,
      now,
    });

    expect(result.weekendBonusApplied).toBe(true);
    expect(result.pointsAwarded).toBe(20); // 10 * 2 (family override), not 15 (default 1.5x)
  });

  it("applies the streak bonus once the weekly total reaches the threshold", async () => {
    const { deps } = createFakeDeps({ weeklyPoints: 20 });
    const now = new Date("2026-09-14T12:00:00.000Z"); // Monday, no weekend multiplier

    const result = await reviewTaskCompletion(deps, {
      taskId: TASK_ID,
      completionId: "completion-1",
      familyId: FAMILY_ID,
      parentId: PARENT_ID,
      approve: true,
      now,
    });

    expect(result.streakBonusApplied).toBe(true);
    expect(result.pointsAwarded).toBe(11); // Math.round(10 * 1.1)
  });

  it("upgrades the badge tier when the new balance crosses a threshold", async () => {
    const { deps, state } = createFakeDeps({
      completion: { task: { id: TASK_ID, familyId: FAMILY_ID, childId: CHILD_ID, points: 500 } },
      child: { pointsBalance: 0, badgeTier: "BRONZE" },
    });
    const now = new Date("2026-09-14T12:00:00.000Z");

    const result = await reviewTaskCompletion(deps, {
      taskId: TASK_ID,
      completionId: "completion-1",
      familyId: FAMILY_ID,
      parentId: PARENT_ID,
      approve: true,
      now,
    });

    expect(result.newBadgeTier).toBe("SILVER");
    expect(state.child.badgeTier).toBe("SILVER");
  });

  it("throws NOT_FOUND for a completion belonging to a different family", async () => {
    const { deps } = createFakeDeps();

    await expect(
      reviewTaskCompletion(deps, {
        taskId: TASK_ID,
        completionId: "completion-1",
        familyId: "another-family",
        parentId: PARENT_ID,
        approve: true,
      }),
    ).rejects.toThrow(AppError);
  });

  it("throws CONFLICT when the completion was already reviewed", async () => {
    const { deps } = createFakeDeps({ completion: { status: "APPROVED" } });

    await expect(
      reviewTaskCompletion(deps, {
        taskId: TASK_ID,
        completionId: "completion-1",
        familyId: FAMILY_ID,
        parentId: PARENT_ID,
        approve: true,
      }),
    ).rejects.toThrow(/já foi revisada/);
  });
});
