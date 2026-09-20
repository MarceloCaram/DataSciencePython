/**
 * "Backend" local em memória, usado como fallback quando `EXPO_PUBLIC_API_URL`
 * não responde (ver src/api/http.ts -> withFallback). Segue as mesmas formas
 * de request/response do docs/API_CONTRACT.md e os tipos de
 * packages/shared/domain.ts, para que trocar para o backend real não exija
 * mudar nenhuma tela.
 *
 * É deliberadamente stateful (arrays mutáveis no módulo) para que o fluxo
 * completo — criar tarefa, concluir, aprovar, creditar pontos, resgatar —
 * funcione de ponta a ponta mesmo sem o backend rodando durante o
 * desenvolvimento do app mobile.
 */
import { GAMIFICATION_DEFAULTS } from "../../../../packages/shared/domain";
import type {
  BadgeTier,
  Child,
  Family,
  Parent,
  Reward,
  Task,
  TaskCompletion,
  WalletTransaction,
} from "../../../../packages/shared/domain";
import { ApiError } from "./errors";
import { MOCK_LATENCY_MS } from "./config";
import type {
  ChildLoginResponse,
  CreateChildInput,
  CreateRewardInput,
  CreateTaskInput,
  DashboardOverview,
  ParentLoginResponse,
  PendingApproval,
  PendingRedemption,
  RedemptionRequestDTO,
  UpdateChildInput,
  WalletSummary,
} from "./types";
import type { FamilySettings } from "../../../../packages/shared/domain";

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), MOCK_LATENCY_MS));
}

function computeBadgeTier(points: number): BadgeTier {
  const { badgeThresholds } = GAMIFICATION_DEFAULTS;
  if (points >= badgeThresholds.GOLD) return "GOLD";
  if (points >= badgeThresholds.SILVER) return "SILVER";
  return "BRONZE";
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const family: Family = {
  id: "fam-1",
  name: "Família Silva",
  createdAt: isoDaysFromNow(-120),
  weekendMultiplier: GAMIFICATION_DEFAULTS.weekendMultiplier,
};

const parent: Parent = {
  id: "parent-1",
  familyId: family.id,
  name: "Marcela Silva",
  email: "pai@mingalbank.com",
  twoFactorEnabled: false,
};

/** Só existe no mock: o backend real faz hash da senha. */
const parentCredentials: Record<string, string> = {
  "pai@mingalbank.com": "mingal123",
};

const children: Child[] = [
  {
    id: "child-1",
    familyId: family.id,
    name: "Théo",
    photoUrl: undefined,
    birthDate: "2016-04-12",
    trustLevel: 4,
    allowanceValue: 100,
    allowancePeriod: "MONTHLY",
    pointsBalance: 240,
    walletBalance: 45,
    currentStreak: 7,
    badgeTier: computeBadgeTier(240),
  },
  {
    id: "child-2",
    familyId: family.id,
    name: "Luiza",
    photoUrl: undefined,
    birthDate: "2018-08-03",
    trustLevel: 3,
    allowanceValue: 20,
    allowancePeriod: "WEEKLY",
    pointsBalance: 80,
    walletBalance: 10,
    currentStreak: 2,
    badgeTier: computeBadgeTier(80),
  },
];

/** Só existe no mock: o backend real guarda o PIN com hash. */
const childPins: Record<string, string> = {
  "child-1": "1234",
  "child-2": "5678",
};

let tasks: Task[] = [
  {
    id: "task-1",
    familyId: family.id,
    childId: "child-1",
    title: "Arrumar a cama",
    category: "HOME",
    points: 5,
    createdAt: isoDaysFromNow(-1),
  },
  {
    id: "task-2",
    familyId: family.id,
    childId: "child-1",
    title: "Ler 20 minutos",
    category: "STUDY",
    points: 8,
    createdAt: isoDaysFromNow(-1),
  },
  {
    id: "task-3",
    familyId: family.id,
    childId: "child-1",
    title: "Escovar os dentes 2x",
    category: "HEALTH",
    points: 3,
    createdAt: isoDaysFromNow(-1),
  },
  {
    id: "task-4",
    familyId: family.id,
    childId: "child-2",
    title: "Guardar os brinquedos",
    category: "HOME",
    points: 4,
    createdAt: isoDaysFromNow(-1),
  },
  {
    id: "task-5",
    familyId: family.id,
    childId: "child-2",
    title: "Desenhar algo novo",
    category: "CREATIVITY",
    points: 6,
    createdAt: isoDaysFromNow(-1),
  },
];

let taskCompletions: TaskCompletion[] = [
  {
    id: "completion-1",
    taskId: "task-2",
    childId: "child-1",
    status: "PENDING",
    evidenceUrl: undefined,
    completedAt: isoDaysFromNow(0),
  },
  {
    id: "completion-2",
    taskId: "task-4",
    childId: "child-2",
    status: "PENDING",
    evidenceUrl: "https://images.unsplash.com/photo-1560184611-ff3e53f00e8f?w=400",
    completedAt: isoDaysFromNow(0),
  },
];

let rewards: Reward[] = [
  { id: "reward-1", familyId: family.id, title: "10 minutos a mais antes de dormir", type: "PRIVILEGE", pointsCost: 50 },
  { id: "reward-2", familyId: family.id, title: "Sorvete no fim de semana", type: "PRIVILEGE", pointsCost: 60 },
  { id: "reward-3", familyId: family.id, title: "Pedir algo especial", type: "PRIVILEGE", pointsCost: 80 },
  { id: "reward-4", familyId: family.id, title: "Trocar 100 pontos por R$ 50", type: "CASH", pointsCost: 100, cashValue: 50 },
];

let walletTransactions: WalletTransaction[] = [
  {
    id: uid("wtx"),
    childId: "child-1",
    type: "ALLOWANCE_CREDIT",
    points: 100,
    amount: 100,
    description: "Mesada mensal de setembro",
    createdAt: isoDaysFromNow(-15),
  },
  {
    id: uid("wtx"),
    childId: "child-1",
    type: "TASK_REWARD",
    points: 8,
    description: "Tarefa: Ler 20 minutos",
    createdAt: isoDaysFromNow(-3),
  },
  {
    id: uid("wtx"),
    childId: "child-1",
    type: "STREAK_BONUS",
    points: 10,
    description: "Bônus de sequência (7 dias seguidos)",
    createdAt: isoDaysFromNow(-1),
  },
  {
    id: uid("wtx"),
    childId: "child-2",
    type: "ALLOWANCE_CREDIT",
    points: 20,
    amount: 20,
    description: "Mesada semanal",
    createdAt: isoDaysFromNow(-5),
  },
];

let redemptionRequests: RedemptionRequestDTO[] = [
  {
    id: "redemption-1",
    childId: "child-2",
    amount: 10,
    status: "PENDING",
    requestedAt: isoDaysFromNow(0),
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireChild(childId: string): Child {
  const child = children.find((entry) => entry.id === childId);
  if (!child) throw new ApiError("Filho não encontrado", "NOT_FOUND", 404);
  return child;
}

function requireTask(taskId: string): Task {
  const task = tasks.find((entry) => entry.id === taskId);
  if (!task) throw new ApiError("Tarefa não encontrada", "NOT_FOUND", 404);
  return task;
}

// ---------------------------------------------------------------------------
// Mock "endpoints"
// ---------------------------------------------------------------------------

export const mockApi = {
  // --- auth ---
  async parentLogin(email: string, password: string): Promise<ParentLoginResponse> {
    const known = parentCredentials[email.trim().toLowerCase()];
    if (!known || known !== password) {
      throw new ApiError("E-mail ou senha inválidos", "INVALID_CREDENTIALS", 401);
    }
    return delay({ token: `mock-token-parent-${parent.id}`, parent });
  },

  async childLogin(childId: string, pin: string): Promise<ChildLoginResponse> {
    const child = requireChild(childId);
    if (childPins[childId] !== pin) {
      throw new ApiError("PIN incorreto", "INVALID_PIN", 401);
    }
    return delay({ token: `mock-token-child-${child.id}`, child: { ...child } });
  },

  // --- children ---
  async listChildren(): Promise<Child[]> {
    return delay([...children]);
  },

  async getChild(childId: string): Promise<Child> {
    return delay({ ...requireChild(childId) });
  },

  async createChild(input: CreateChildInput): Promise<Child> {
    const child: Child = {
      id: uid("child"),
      familyId: family.id,
      name: input.name,
      photoUrl: input.photoUrl,
      birthDate: input.birthDate,
      trustLevel: input.trustLevel,
      allowanceValue: input.allowanceValue,
      allowancePeriod: input.allowancePeriod,
      pointsBalance: 0,
      walletBalance: 0,
      currentStreak: 0,
      badgeTier: "BRONZE",
    };
    children.push(child);
    childPins[child.id] = "0000";
    return delay(child);
  },

  async updateChild(childId: string, patch: UpdateChildInput): Promise<Child> {
    const child = requireChild(childId);
    Object.assign(child, patch);
    return delay({ ...child });
  },

  // --- tasks ---
  async listTasks(filter: { childId?: string; status?: TaskCompletion["status"] }): Promise<Task[]> {
    let result = tasks;
    if (filter.childId) result = result.filter((task) => task.childId === filter.childId);
    const weekendBonus = isWeekend(new Date()) ? family.weekendMultiplier : 1;
    return delay(
      result.map((task) => ({ ...task, effectivePoints: Math.round(task.points * weekendBonus) }))
    );
  },

  async createTask(input: CreateTaskInput): Promise<Task> {
    requireChild(input.childId);
    const task: Task = {
      id: uid("task"),
      familyId: family.id,
      childId: input.childId,
      title: input.title,
      category: input.category,
      points: input.points,
      createdAt: new Date().toISOString(),
    };
    tasks = [task, ...tasks];
    return delay(task);
  },

  async listTaskCompletions(filter: { childId?: string; status?: TaskCompletion["status"] }): Promise<TaskCompletion[]> {
    let result = taskCompletions;
    if (filter.childId) result = result.filter((completion) => completion.childId === filter.childId);
    if (filter.status) result = result.filter((completion) => completion.status === filter.status);
    return delay([...result]);
  },

  async completeTask(taskId: string, childId: string, evidenceUrl?: string): Promise<TaskCompletion> {
    requireTask(taskId);
    const completion: TaskCompletion = {
      id: uid("completion"),
      taskId,
      childId,
      status: "PENDING",
      evidenceUrl,
      completedAt: new Date().toISOString(),
    };
    taskCompletions = [completion, ...taskCompletions];
    return delay(completion);
  },

  async reviewTaskCompletion(
    completionId: string,
    approve: boolean,
    reviewerParentId: string
  ): Promise<TaskCompletion> {
    const completion = taskCompletions.find((entry) => entry.id === completionId);
    if (!completion) throw new ApiError("Conclusão não encontrada", "NOT_FOUND", 404);

    completion.status = approve ? "APPROVED" : "REJECTED";
    completion.reviewedAt = new Date().toISOString();
    completion.reviewedByParentId = reviewerParentId;

    if (approve) {
      const task = requireTask(completion.taskId);
      const child = requireChild(completion.childId);
      const weekendBonus = isWeekend(new Date()) ? family.weekendMultiplier : 1;
      const earnedPoints = Math.round(task.points * weekendBonus);
      child.pointsBalance += earnedPoints;
      child.currentStreak += 1;
      child.badgeTier = computeBadgeTier(child.pointsBalance);

      walletTransactions = [
        {
          id: uid("wtx"),
          childId: child.id,
          type: "TASK_REWARD",
          points: earnedPoints,
          description: `Tarefa aprovada: ${task.title}`,
          createdAt: new Date().toISOString(),
        },
        ...walletTransactions,
      ];

      if (child.currentStreak > 0 && child.currentStreak % 7 === 0) {
        const bonus = Math.round(child.pointsBalance * GAMIFICATION_DEFAULTS.streakBonusPercent);
        child.pointsBalance += bonus;
        child.badgeTier = computeBadgeTier(child.pointsBalance);
        walletTransactions = [
          {
            id: uid("wtx"),
            childId: child.id,
            type: "STREAK_BONUS",
            points: bonus,
            description: `Bônus de sequência (${child.currentStreak} dias seguidos)`,
            createdAt: new Date().toISOString(),
          },
          ...walletTransactions,
        ];
      }
    }

    return delay({ ...completion });
  },

  // --- wallet ---
  async getWalletSummary(childId: string): Promise<WalletSummary> {
    const child = requireChild(childId);
    return delay({
      pointsBalance: child.pointsBalance,
      walletBalance: child.walletBalance,
      currentStreak: child.currentStreak,
      badgeTier: child.badgeTier,
    });
  },

  async getTransactions(childId: string): Promise<WalletTransaction[]> {
    return delay(walletTransactions.filter((tx) => tx.childId === childId));
  },

  async requestRedemption(childId: string, points: number): Promise<RedemptionRequestDTO> {
    const child = requireChild(childId);
    if (points <= 0 || points > child.pointsBalance) {
      throw new ApiError("Saldo de pontos insuficiente", "INSUFFICIENT_POINTS", 400);
    }
    const request: RedemptionRequestDTO = {
      id: uid("redemption"),
      childId,
      amount: points,
      status: "PENDING",
      requestedAt: new Date().toISOString(),
    };
    redemptionRequests = [request, ...redemptionRequests];
    return delay(request);
  },

  async reviewRedemption(redemptionId: string, approve: boolean): Promise<RedemptionRequestDTO> {
    const req = redemptionRequests.find((entry) => entry.id === redemptionId);
    if (!req) throw new ApiError("Resgate não encontrado", "NOT_FOUND", 404);
    req.status = approve ? "APPROVED" : "REJECTED";
    req.reviewedAt = new Date().toISOString();

    if (approve) {
      const child = requireChild(req.childId);
      const cashOut = req.amount * 0.5; // conversão simples de demonstração (100 pts = R$50)
      child.pointsBalance -= req.amount;
      child.walletBalance += cashOut;
      walletTransactions = [
        {
          id: uid("wtx"),
          childId: child.id,
          type: "REDEMPTION",
          points: -req.amount,
          amount: cashOut,
          description: "Resgate de mesada aprovado",
          createdAt: new Date().toISOString(),
        },
        ...walletTransactions,
      ];
    }

    return delay({ ...req });
  },

  // --- rewards ---
  async listRewards(): Promise<Reward[]> {
    return delay([...rewards]);
  },

  async createReward(input: CreateRewardInput): Promise<Reward> {
    const reward: Reward = {
      id: uid("reward"),
      familyId: family.id,
      title: input.title,
      type: input.type,
      pointsCost: input.pointsCost,
      cashValue: input.cashValue,
    };
    rewards = [reward, ...rewards];
    return delay(reward);
  },

  async claimReward(childId: string, rewardId: string): Promise<WalletTransaction> {
    const child = requireChild(childId);
    const reward = rewards.find((entry) => entry.id === rewardId);
    if (!reward) throw new ApiError("Recompensa não encontrada", "NOT_FOUND", 404);
    if (child.pointsBalance < reward.pointsCost) {
      throw new ApiError("Pontos insuficientes para essa recompensa", "INSUFFICIENT_POINTS", 400);
    }
    child.pointsBalance -= reward.pointsCost;
    if (reward.type === "CASH" && reward.cashValue) {
      child.walletBalance += reward.cashValue;
    }
    child.badgeTier = computeBadgeTier(child.pointsBalance);
    const tx: WalletTransaction = {
      id: uid("wtx"),
      childId,
      type: "REWARD_REDEMPTION",
      points: -reward.pointsCost,
      amount: reward.type === "CASH" ? reward.cashValue : undefined,
      description: `Recompensa resgatada: ${reward.title}`,
      createdAt: new Date().toISOString(),
    };
    walletTransactions = [tx, ...walletTransactions];
    return delay(tx);
  },

  // --- dashboard ---
  async getDashboard(): Promise<DashboardOverview> {
    const weekendBonus = isWeekend(new Date()) ? family.weekendMultiplier : 1;
    const pendingTaskApprovals: PendingApproval[] = taskCompletions
      .filter((completion) => completion.status === "PENDING")
      .map((completion) => {
        const task = tasks.find((entry) => entry.id === completion.taskId);
        const child = children.find((entry) => entry.id === completion.childId);
        const basePoints = task?.points ?? 0;
        return {
          ...completion,
          taskTitle: task?.title ?? "Tarefa removida",
          childName: child?.name ?? "Filho(a)",
          points: basePoints,
          effectivePoints: Math.round(basePoints * weekendBonus),
        };
      });

    const pendingRedemptions: PendingRedemption[] = redemptionRequests
      .filter((redemption) => redemption.status === "PENDING")
      .map((redemption) => ({
        ...redemption,
        childName: children.find((entry) => entry.id === redemption.childId)?.name ?? "Filho(a)",
      }));

    return delay({
      family,
      children: [...children],
      pendingTaskApprovals,
      pendingRedemptions,
    });
  },

  // --- family settings ---
  async getFamilySettings(): Promise<FamilySettings> {
    return delay({ weekendMultiplier: family.weekendMultiplier });
  },

  async updateFamilySettings(patch: FamilySettings): Promise<FamilySettings> {
    family.weekendMultiplier = patch.weekendMultiplier;
    return delay({ weekendMultiplier: family.weekendMultiplier });
  },
};
