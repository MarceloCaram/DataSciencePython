import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { serializeChild, serializeRedemptionRequest, serializeTask, serializeTaskCompletion } from "../../lib/serializers";

/**
 * Parent-only overview: children in the family, pending task completions
 * awaiting approval, and pending redemption requests.
 */
export async function getDashboard(req: Request, res: Response): Promise<void> {
  const familyId = req.user!.familyId;

  const [children, pendingCompletions, pendingRedemptions] = await Promise.all([
    prisma.child.findMany({ where: { familyId }, orderBy: { createdAt: "asc" } }),
    prisma.taskCompletion.findMany({
      where: { status: "PENDING", task: { familyId } },
      include: { task: true },
      orderBy: { completedAt: "asc" },
    }),
    prisma.redemptionRequest.findMany({
      where: { status: "PENDING", child: { familyId } },
      include: { child: true },
      orderBy: { requestedAt: "asc" },
    }),
  ]);

  res.status(200).json({
    children: children.map(serializeChild),
    pendingTaskCompletions: pendingCompletions.map((completion) => ({
      ...serializeTaskCompletion(completion),
      task: serializeTask(completion.task),
    })),
    pendingRedemptions: pendingRedemptions.map(serializeRedemptionRequest),
  });
}
