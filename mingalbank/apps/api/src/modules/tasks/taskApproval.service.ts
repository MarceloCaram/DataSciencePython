/**
 * Task completion review flow, isolated from Express so it can be unit
 * tested with a mocked Prisma client (see apps/api/test/taskApproval.test.ts).
 */
import { AppError } from "../../lib/errors";
import { calculateTaskPoints, computeBadgeTier, computeNextStreak, getWeekRange } from "../wallet/gamification";

// Narrow structural types for the subset of Prisma models this service
// touches, so tests can pass simple plain objects/mocks instead of a real
// PrismaClient.
export interface TaskCompletionRecord {
  id: string;
  taskId: string;
  childId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  evidenceUrl?: string | null;
  completedAt: Date;
  reviewedAt?: Date | null;
  reviewedByParentId?: string | null;
  task: {
    id: string;
    familyId: string;
    childId: string;
    points: number;
  };
}

export interface ChildRecord {
  id: string;
  familyId: string;
  pointsBalance: number;
  currentStreak: number;
  lastApprovedDate: Date | null;
  badgeTier: "BRONZE" | "SILVER" | "GOLD";
}

export interface TaskApprovalDeps {
  findCompletion(completionId: string, taskId: string): Promise<TaskCompletionRecord | null>;
  findChild(childId: string): Promise<ChildRecord | null>;
  sumWeeklyTaskRewardPoints(childId: string, weekStart: Date, weekEnd: Date): Promise<number>;
  applyApproval(input: {
    completionId: string;
    childId: string;
    reviewedAt: Date;
    reviewedByParentId: string;
    finalPoints: number;
    nextStreak: number;
    newPointsBalance: number;
    newBadgeTier: "BRONZE" | "SILVER" | "GOLD";
    description: string;
  }): Promise<void>;
  applyRejection(input: { completionId: string; reviewedAt: Date; reviewedByParentId: string }): Promise<void>;
}

export interface ReviewTaskCompletionParams {
  taskId: string;
  completionId: string;
  familyId: string;
  parentId: string;
  approve: boolean;
  now?: Date;
}

export interface ReviewTaskCompletionResult {
  status: "APPROVED" | "REJECTED";
  pointsAwarded?: number;
  weekendBonusApplied?: boolean;
  streakBonusApplied?: boolean;
  nextStreak?: number;
  newPointsBalance?: number;
  newBadgeTier?: "BRONZE" | "SILVER" | "GOLD";
}

export async function reviewTaskCompletion(
  deps: TaskApprovalDeps,
  params: ReviewTaskCompletionParams,
): Promise<ReviewTaskCompletionResult> {
  const now = params.now ?? new Date();

  const completion = await deps.findCompletion(params.completionId, params.taskId);
  if (!completion || completion.task.familyId !== params.familyId) {
    throw AppError.notFound("Conclusão de tarefa não encontrada", "TASK_COMPLETION_NOT_FOUND");
  }
  if (completion.status !== "PENDING") {
    throw AppError.conflict("Esta conclusão de tarefa já foi revisada", "TASK_COMPLETION_ALREADY_REVIEWED");
  }

  if (!params.approve) {
    await deps.applyRejection({ completionId: completion.id, reviewedAt: now, reviewedByParentId: params.parentId });
    return { status: "REJECTED" };
  }

  const child = await deps.findChild(completion.childId);
  if (!child) {
    throw AppError.notFound("Filho não encontrado", "CHILD_NOT_FOUND");
  }

  const { start, end } = getWeekRange(now);
  const weeklyPointsBeforeThisTask = await deps.sumWeeklyTaskRewardPoints(child.id, start, end);

  const { finalPoints, weekendBonusApplied, streakBonusApplied } = calculateTaskPoints({
    basePoints: completion.task.points,
    completedAt: now,
    weeklyPointsBeforeThisTask,
  });

  const nextStreak = computeNextStreak(child.currentStreak, child.lastApprovedDate, now);
  const newPointsBalance = child.pointsBalance + finalPoints;
  const newBadgeTier = computeBadgeTier(newPointsBalance);

  const bonusNotes = [
    weekendBonusApplied ? "bônus de fim de semana (1.5x)" : null,
    streakBonusApplied ? "bônus de streak (+10%)" : null,
  ].filter(Boolean);
  const description =
    bonusNotes.length > 0
      ? `Tarefa aprovada (${bonusNotes.join(", ")}): +${finalPoints} pontos`
      : `Tarefa aprovada: +${finalPoints} pontos`;

  await deps.applyApproval({
    completionId: completion.id,
    childId: child.id,
    reviewedAt: now,
    reviewedByParentId: params.parentId,
    finalPoints,
    nextStreak,
    newPointsBalance,
    newBadgeTier,
    description,
  });

  return {
    status: "APPROVED",
    pointsAwarded: finalPoints,
    weekendBonusApplied,
    streakBonusApplied,
    nextStreak,
    newPointsBalance,
    newBadgeTier,
  };
}
