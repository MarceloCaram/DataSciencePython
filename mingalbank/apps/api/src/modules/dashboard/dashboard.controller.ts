import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { serializeChild, serializeRedemptionRequest, serializeTaskCompletion } from "../../lib/serializers";
import { applyWeekendMultiplier } from "../wallet/gamification";

/**
 * Parent-only overview: children in the family, pending task completions
 * awaiting approval (flattened with taskTitle/childName/points, matching
 * the PendingApproval contract in packages/shared and apps/mobile — do not
 * nest a raw `task` object here, the mobile app doesn't expect it), and
 * pending redemption requests.
 */
export async function getDashboard(req: Request, res: Response): Promise<void> {
  const familyId = req.user!.familyId;

  const [family, children, pendingCompletions, pendingRedemptions] = await Promise.all([
    prisma.family.findUnique({ where: { id: familyId }, select: { weekendMultiplier: true } }),
    prisma.child.findMany({ where: { familyId }, orderBy: { createdAt: "asc" } }),
    prisma.taskCompletion.findMany({
      where: { status: "PENDING", task: { familyId } },
      include: { task: true, child: true },
      orderBy: { completedAt: "asc" },
    }),
    prisma.redemptionRequest.findMany({
      where: { status: "PENDING", child: { familyId } },
      include: { child: true },
      orderBy: { requestedAt: "asc" },
    }),
  ]);

  const now = new Date();

  res.status(200).json({
    children: children.map(serializeChild),
    pendingTaskApprovals: pendingCompletions.map((completion) => ({
      ...serializeTaskCompletion(completion),
      taskTitle: completion.task.title,
      childName: completion.child.name,
      points: completion.task.points,
      // Pontos que serão creditados se o pai aprovar agora (já com o
      // multiplicador de fim de semana) — evita o pai ver um valor
      // diferente do que a criança viu na lista de tarefas.
      effectivePoints: applyWeekendMultiplier(completion.task.points, now, family?.weekendMultiplier),
    })),
    pendingRedemptions: pendingRedemptions.map((redemption) => ({
      ...serializeRedemptionRequest(redemption),
      childName: redemption.child.name,
    })),
  });
}
