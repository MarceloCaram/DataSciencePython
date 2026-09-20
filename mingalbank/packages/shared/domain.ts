/**
 * Contrato de domínio compartilhado entre apps/api e apps/mobile.
 * Mantido em sincronia manual (sem build step) — qualquer mudança aqui deve
 * ser refletida nos dois lados antes de ser considerada concluída.
 */

export type UserRole = "PARENT" | "CHILD";

export type AllowancePeriod = "WEEKLY" | "MONTHLY";

export type TaskCategory = "HEALTH" | "STUDY" | "HOME" | "CREATIVITY";

export type TaskCompletionStatus = "PENDING" | "APPROVED" | "REJECTED";

export type RewardType = "PRIVILEGE" | "CASH";

export type TransactionType =
  | "ALLOWANCE_CREDIT"
  | "TASK_REWARD"
  | "STREAK_BONUS"
  | "REDEMPTION"
  | "REWARD_REDEMPTION";

export type BadgeTier = "BRONZE" | "SILVER" | "GOLD";

export interface Family {
  id: string;
  name: string;
  createdAt: string;
}

export interface Parent {
  id: string;
  familyId: string;
  name: string;
  email: string;
  twoFactorEnabled: boolean;
}

export interface Child {
  id: string;
  familyId: string;
  name: string;
  photoUrl?: string;
  birthDate: string;
  trustLevel: number;
  allowanceValue: number;
  allowancePeriod: AllowancePeriod;
  pointsBalance: number;
  walletBalance: number;
  currentStreak: number;
  badgeTier: BadgeTier;
}

export interface TaskTemplate {
  id: string;
  title: string;
  category: TaskCategory;
  defaultPoints: number;
}

export interface Task {
  id: string;
  familyId: string;
  childId: string;
  title: string;
  category: TaskCategory;
  points: number;
  dueDate: string;
  createdAt: string;
}

export interface TaskCompletion {
  id: string;
  taskId: string;
  childId: string;
  status: TaskCompletionStatus;
  evidenceUrl?: string;
  completedAt: string;
  reviewedAt?: string;
  reviewedByParentId?: string;
}

export interface Reward {
  id: string;
  familyId: string;
  title: string;
  type: RewardType;
  pointsCost: number;
  cashValue?: number;
}

export interface WalletTransaction {
  id: string;
  childId: string;
  type: TransactionType;
  points?: number;
  amount?: number;
  description: string;
  createdAt: string;
}

export interface RedemptionRequest {
  id: string;
  childId: string;
  amount: number;
  status: TaskCompletionStatus;
  requestedAt: string;
  reviewedAt?: string;
}

// Regras de gamificação (valores default configuráveis por família)
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
