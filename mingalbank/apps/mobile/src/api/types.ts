/**
 * Tipos de request/response específicos do client HTTP, compostos a partir
 * dos tipos de domínio compartilhados (`packages/shared/domain.ts`). Não
 * redefinem entidades — só descrevem o formato das respostas do
 * `docs/API_CONTRACT.md`.
 */
import {
  AllowancePeriod,
  BadgeTier,
  Child,
  Family,
  Parent,
  Reward,
  RewardType,
  Task,
  TaskCategory,
  TaskCompletion,
  WalletTransaction,
} from "../../../../packages/shared/domain";

export interface ParentLoginResponse {
  token: string;
  parent: Parent;
}

export interface ParentRegisterResponse {
  token: string;
  parent: Parent;
  family: Family;
}

export interface ChildLoginResponse {
  token: string;
  child: Child;
}

export interface CreateChildInput {
  name: string;
  birthDate: string;
  photoUrl?: string;
  trustLevel: number;
  allowanceValue: number;
  allowancePeriod: AllowancePeriod;
}

export interface UpdateChildInput {
  allowanceValue?: number;
  allowancePeriod?: AllowancePeriod;
  trustLevel?: number;
}

export interface CreateTaskInput {
  childId: string;
  title: string;
  category: TaskCategory;
  points: number;
  dueDate: string;
}

export interface CompleteTaskInput {
  evidenceUrl?: string;
}

export interface WalletSummary {
  pointsBalance: number;
  walletBalance: number;
  currentStreak: number;
  badgeTier: BadgeTier;
}

export interface RedemptionRequestDTO {
  id: string;
  childId: string;
  amount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedAt: string;
  reviewedAt?: string;
}

export interface CreateRewardInput {
  title: string;
  type: RewardType;
  pointsCost: number;
  cashValue?: number;
}

/** Uma tarefa concluída "enriquecida" com o nome do filho e da tarefa, como
 * a tela de aprovações precisa para exibir sem fazer N chamadas extras. */
export interface PendingApproval extends TaskCompletion {
  taskTitle: string;
  childName: string;
  points: number;
}

export interface PendingRedemption extends RedemptionRequestDTO {
  childName: string;
}

export interface DashboardOverview {
  family: Family;
  children: Child[];
  pendingTaskApprovals: PendingApproval[];
  pendingRedemptions: PendingRedemption[];
}

export type { Task, TaskCompletion, Reward, WalletTransaction, Child, Parent, Family };
