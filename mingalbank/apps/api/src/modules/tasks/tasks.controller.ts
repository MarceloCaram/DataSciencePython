import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { serializeTask, serializeTaskCompletion } from "../../lib/serializers";
import type { TaskApprovalDeps } from "./taskApproval.service";
import { reviewTaskCompletion } from "./taskApproval.service";
import type { CompleteTaskInput, CreateTaskInput, ListTasksQuery, ReviewCompletionInput } from "./tasks.schemas";

export async function createTask(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateTaskInput;
  const familyId = req.user!.familyId;

  const child = await prisma.child.findFirst({ where: { id: input.childId, familyId } });
  if (!child) {
    throw AppError.notFound("Filho não encontrado nesta família", "CHILD_NOT_FOUND");
  }

  const task = await prisma.task.create({
    data: {
      familyId,
      childId: input.childId,
      title: input.title,
      category: input.category,
      points: input.points,
      dueDate: input.dueDate,
    },
  });

  res.status(201).json({ task: serializeTask(task) });
}

export async function listTasks(req: Request, res: Response): Promise<void> {
  const { childId, status } = req.query as unknown as ListTasksQuery;
  const familyId = req.user!.familyId;

  const where: Record<string, unknown> = {};

  if (req.user!.role === "CHILD") {
    where.childId = req.user!.id;
  } else {
    where.familyId = familyId;
    if (childId) where.childId = childId;
  }

  const tasks = await prisma.task.findMany({
    where,
    include: status ? { completions: { where: { status } } } : { completions: true },
    orderBy: { dueDate: "asc" },
  });

  const filtered = status ? tasks.filter((t) => t.completions.length > 0) : tasks;

  res.status(200).json({
    tasks: filtered.map((t) => ({
      ...serializeTask(t),
      completions: t.completions.map(serializeTaskCompletion),
    })),
  });
}

export async function completeTask(req: Request, res: Response): Promise<void> {
  const { evidenceUrl } = req.body as CompleteTaskInput;
  const childId = req.user!.id;
  const taskId = req.params.id;

  const task = await prisma.task.findFirst({ where: { id: taskId, childId } });
  if (!task) {
    throw AppError.notFound("Tarefa não encontrada para este filho", "TASK_NOT_FOUND");
  }

  const pendingExisting = await prisma.taskCompletion.findFirst({
    where: { taskId, childId, status: "PENDING" },
  });
  if (pendingExisting) {
    throw AppError.conflict("Esta tarefa já possui uma conclusão aguardando revisão", "TASK_ALREADY_PENDING");
  }

  const completion = await prisma.taskCompletion.create({
    data: { taskId, childId, evidenceUrl, status: "PENDING" },
  });

  res.status(201).json({ completion: serializeTaskCompletion(completion) });
}

function buildPrismaApprovalDeps(): TaskApprovalDeps {
  return {
    async findCompletion(completionId, taskId) {
      const completion = await prisma.taskCompletion.findFirst({
        where: { id: completionId, taskId },
        include: { task: true },
      });
      return completion as unknown as Awaited<ReturnType<TaskApprovalDeps["findCompletion"]>>;
    },
    async findChild(childId) {
      const child = await prisma.child.findUnique({ where: { id: childId } });
      return child as unknown as Awaited<ReturnType<TaskApprovalDeps["findChild"]>>;
    },
    async sumWeeklyTaskRewardPoints(childId, weekStart, weekEnd) {
      const aggregate = await prisma.walletTransaction.aggregate({
        _sum: { points: true },
        where: {
          childId,
          type: "TASK_REWARD",
          createdAt: { gte: weekStart, lte: weekEnd },
        },
      });
      return aggregate._sum.points ?? 0;
    },
    async applyApproval(input) {
      await prisma.$transaction([
        prisma.taskCompletion.update({
          where: { id: input.completionId },
          data: { status: "APPROVED", reviewedAt: input.reviewedAt, reviewedByParentId: input.reviewedByParentId },
        }),
        prisma.child.update({
          where: { id: input.childId },
          data: {
            pointsBalance: input.newPointsBalance,
            currentStreak: input.nextStreak,
            lastApprovedDate: input.reviewedAt,
            badgeTier: input.newBadgeTier,
          },
        }),
        prisma.walletTransaction.create({
          data: {
            childId: input.childId,
            type: "TASK_REWARD",
            points: input.finalPoints,
            description: input.description,
          },
        }),
      ]);
    },
    async applyRejection(input) {
      await prisma.taskCompletion.update({
        where: { id: input.completionId },
        data: { status: "REJECTED", reviewedAt: input.reviewedAt, reviewedByParentId: input.reviewedByParentId },
      });
    },
  };
}

export async function reviewCompletion(req: Request, res: Response): Promise<void> {
  const { approve } = req.body as ReviewCompletionInput;
  const familyId = req.user!.familyId;
  const parentId = req.user!.id;
  const { id: taskId, completionId } = req.params;

  const result = await reviewTaskCompletion(buildPrismaApprovalDeps(), {
    taskId,
    completionId,
    familyId,
    parentId,
    approve,
  });

  res.status(200).json(result);
}
