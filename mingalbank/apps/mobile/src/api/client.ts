/**
 * Client de API tipado por recurso, seguindo `docs/API_CONTRACT.md`.
 *
 * Cada função tenta primeiro a chamada HTTP real (`request`, ver
 * src/api/http.ts) contra `EXPO_PUBLIC_API_URL`; se o backend estiver
 * inalcançável (timeout/offline), cai automaticamente para os dados
 * mockados locais (`src/api/mock.ts`) — a UI nunca trava esperando um
 * servidor que não está rodando. Erros de negócio (401 senha errada, 400
 * validação, etc.) sempre vêm do lado que respondeu e são propagados.
 */
import type {
  AllowancePeriod,
  BadgeTier,
  Child,
  Reward,
  RewardType,
  Task,
  TaskCategory,
  TaskCompletion,
  TaskCompletionStatus,
  WalletTransaction,
} from "../../../../packages/shared/domain";
import { ApiError } from "./errors";
import { request, withFallback } from "./http";
import { mockApi } from "./mock";
import type {
  ChildLoginResponse,
  CreateChildInput,
  CreateRewardInput,
  CreateTaskInput,
  DashboardOverview,
  ParentLoginResponse,
  ParentRegisterResponse,
  RedemptionRequestDTO,
  UpdateChildInput,
  WalletSummary,
} from "./types";
import type { FamilySettings } from "../../../../packages/shared/domain";

function childIdFromMockToken(token: string | null | undefined): string {
  const match = token?.match(/^mock-token-child-(.+)$/);
  if (!match) {
    throw new ApiError("Sessão inválida para essa ação", "UNAUTHORIZED", 401);
  }
  return match[1];
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const authApi = {
  parentRegister(input: {
    familyName: string;
    parentName: string;
    email: string;
    password: string;
  }): Promise<ParentRegisterResponse> {
    return request<ParentRegisterResponse>("/auth/parent/register", {
      method: "POST",
      body: input,
    });
  },

  parentLogin(email: string, password: string): Promise<ParentLoginResponse> {
    return withFallback(
      () => request<ParentLoginResponse>("/auth/parent/login", { method: "POST", body: { email, password } }),
      () => mockApi.parentLogin(email, password)
    );
  },

  childLogin(childId: string, pin: string): Promise<ChildLoginResponse> {
    return withFallback(
      () => request<ChildLoginResponse>("/auth/child/login", { method: "POST", body: { childId, pin } }),
      () => mockApi.childLogin(childId, pin)
    );
  },

  setChildPin(token: string, childId: string, pin: string): Promise<void> {
    return withFallback(
      () => request<void>("/auth/child/pin", { method: "POST", body: { childId, pin }, token }),
      async () => undefined
    );
  },
};

// ---------------------------------------------------------------------------
// Children
// ---------------------------------------------------------------------------

export const childrenApi = {
  list(token: string): Promise<Child[]> {
    return withFallback(
      () => request<Child[]>("/children", { token }),
      () => mockApi.listChildren()
    );
  },

  get(token: string, childId: string): Promise<Child> {
    return withFallback(
      () => request<Child>(`/children/${childId}`, { token }),
      () => mockApi.getChild(childId)
    );
  },

  create(token: string, input: CreateChildInput): Promise<Child> {
    return withFallback(
      () => request<Child>("/children", { method: "POST", body: input, token }),
      () => mockApi.createChild(input)
    );
  },

  update(token: string, childId: string, patch: UpdateChildInput): Promise<Child> {
    return withFallback(
      () => request<Child>(`/children/${childId}`, { method: "PATCH", body: patch, token }),
      () => mockApi.updateChild(childId, patch)
    );
  },
};

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export const tasksApi = {
  list(token: string, filter: { childId?: string; status?: TaskCompletionStatus } = {}): Promise<Task[]> {
    const params = new URLSearchParams();
    if (filter.childId) params.set("childId", filter.childId);
    if (filter.status) params.set("status", filter.status);
    const qs = params.toString();
    return withFallback(
      () => request<Task[]>(`/tasks${qs ? `?${qs}` : ""}`, { token }),
      () => mockApi.listTasks(filter)
    );
  },

  create(
    token: string,
    input: { childId: string; title: string; category: TaskCategory; points: number }
  ): Promise<Task> {
    return withFallback(
      () => request<Task>("/tasks", { method: "POST", body: input, token }),
      () => mockApi.createTask(input as CreateTaskInput)
    );
  },

  complete(token: string, taskId: string, evidenceUrl?: string): Promise<TaskCompletion> {
    return withFallback(
      () => request<TaskCompletion>(`/tasks/${taskId}/complete`, { method: "POST", body: { evidenceUrl }, token }),
      () => mockApi.completeTask(taskId, childIdFromMockToken(token), evidenceUrl)
    );
  },

  review(token: string, taskId: string, completionId: string, approve: boolean): Promise<TaskCompletion> {
    return withFallback(
      () =>
        request<TaskCompletion>(`/tasks/${taskId}/completions/${completionId}/review`, {
          method: "POST",
          body: { approve },
          token,
        }),
      () => mockApi.reviewTaskCompletion(completionId, approve, "parent-1")
    );
  },
};

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

export const walletApi = {
  getSummary(token: string, childId: string): Promise<WalletSummary> {
    return withFallback(
      () => request<WalletSummary>(`/wallet/${childId}`, { token }),
      () => mockApi.getWalletSummary(childId)
    );
  },

  getTransactions(token: string, childId: string): Promise<WalletTransaction[]> {
    return withFallback(
      () => request<WalletTransaction[]>(`/wallet/${childId}/transactions`, { token }),
      () => mockApi.getTransactions(childId)
    );
  },

  redeem(token: string, childId: string, points: number): Promise<RedemptionRequestDTO> {
    return withFallback(
      () => request<RedemptionRequestDTO>(`/wallet/${childId}/redeem`, { method: "POST", body: { points }, token }),
      () => mockApi.requestRedemption(childId, points)
    );
  },

  reviewRedemption(token: string, redemptionId: string, approve: boolean): Promise<RedemptionRequestDTO> {
    return withFallback(
      () =>
        request<RedemptionRequestDTO>(`/wallet/redemptions/${redemptionId}/review`, {
          method: "POST",
          body: { approve },
          token,
        }),
      () => mockApi.reviewRedemption(redemptionId, approve)
    );
  },
};

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------

export const rewardsApi = {
  list(token: string): Promise<Reward[]> {
    return withFallback(
      () => request<Reward[]>("/rewards", { token }),
      () => mockApi.listRewards()
    );
  },

  create(token: string, input: { title: string; type: RewardType; pointsCost: number; cashValue?: number }): Promise<Reward> {
    return withFallback(
      () => request<Reward>("/rewards", { method: "POST", body: input, token }),
      () => mockApi.createReward(input as CreateRewardInput)
    );
  },

  claim(token: string, rewardId: string): Promise<WalletTransaction> {
    return withFallback(
      () => request<WalletTransaction>(`/rewards/${rewardId}/claim`, { method: "POST", token }),
      () => mockApi.claimReward(childIdFromMockToken(token), rewardId)
    );
  },
};

// ---------------------------------------------------------------------------
// Family settings
// ---------------------------------------------------------------------------

export const familyApi = {
  getSettings(token: string): Promise<FamilySettings> {
    return withFallback(
      () => request<FamilySettings>("/family/settings", { token }),
      () => mockApi.getFamilySettings()
    );
  },

  updateSettings(token: string, patch: FamilySettings): Promise<FamilySettings> {
    return withFallback(
      () => request<FamilySettings>("/family/settings", { method: "PATCH", body: patch, token }),
      () => mockApi.updateFamilySettings(patch)
    );
  },
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export const dashboardApi = {
  get(token: string): Promise<DashboardOverview> {
    return withFallback(
      () => request<DashboardOverview>("/dashboard", { token }),
      () => mockApi.getDashboard()
    );
  },
};

export type { AllowancePeriod, BadgeTier };
export { ApiError };
