import type { Child, Family, Parent, Reward, Task, TaskCompletion, WalletTransaction, RedemptionRequest } from "@prisma/client";

/**
 * Shape Prisma rows into the plain JSON contracts defined in
 * packages/shared/domain.ts, stripping secrets (passwordHash/pinHash) and
 * normalizing dates to ISO strings.
 */

export function serializeFamily(family: Family) {
  return {
    id: family.id,
    name: family.name,
    createdAt: family.createdAt.toISOString(),
  };
}

export function serializeParent(parent: Parent) {
  return {
    id: parent.id,
    familyId: parent.familyId,
    name: parent.name,
    email: parent.email,
    twoFactorEnabled: parent.twoFactorEnabled,
  };
}

export function serializeChild(child: Child) {
  return {
    id: child.id,
    familyId: child.familyId,
    name: child.name,
    photoUrl: child.photoUrl ?? undefined,
    birthDate: child.birthDate.toISOString(),
    trustLevel: child.trustLevel,
    allowanceValue: child.allowanceValue,
    allowancePeriod: child.allowancePeriod,
    pointsBalance: child.pointsBalance,
    walletBalance: child.walletBalance,
    currentStreak: child.currentStreak,
    badgeTier: child.badgeTier,
    hasPin: Boolean(child.pinHash),
  };
}

export function serializeTask(task: Task) {
  return {
    id: task.id,
    familyId: task.familyId,
    childId: task.childId,
    title: task.title,
    category: task.category,
    points: task.points,
    dueDate: task.dueDate.toISOString(),
    createdAt: task.createdAt.toISOString(),
  };
}

export function serializeTaskCompletion(completion: TaskCompletion) {
  return {
    id: completion.id,
    taskId: completion.taskId,
    childId: completion.childId,
    status: completion.status,
    evidenceUrl: completion.evidenceUrl ?? undefined,
    completedAt: completion.completedAt.toISOString(),
    reviewedAt: completion.reviewedAt?.toISOString(),
    reviewedByParentId: completion.reviewedByParentId ?? undefined,
  };
}

export function serializeReward(reward: Reward) {
  return {
    id: reward.id,
    familyId: reward.familyId,
    title: reward.title,
    type: reward.type,
    pointsCost: reward.pointsCost,
    cashValue: reward.cashValue ?? undefined,
  };
}

export function serializeWalletTransaction(tx: WalletTransaction) {
  return {
    id: tx.id,
    childId: tx.childId,
    type: tx.type,
    points: tx.points ?? undefined,
    amount: tx.amount ?? undefined,
    description: tx.description,
    createdAt: tx.createdAt.toISOString(),
  };
}

export function serializeRedemptionRequest(redemption: RedemptionRequest) {
  return {
    id: redemption.id,
    childId: redemption.childId,
    amount: redemption.amount,
    points: redemption.points,
    status: redemption.status,
    requestedAt: redemption.requestedAt.toISOString(),
    reviewedAt: redemption.reviewedAt?.toISOString(),
  };
}
