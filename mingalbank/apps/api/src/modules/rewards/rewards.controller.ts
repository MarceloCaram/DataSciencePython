import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { serializeReward, serializeWalletTransaction } from "../../lib/serializers";
import type { CreateRewardInput } from "./rewards.schemas";

export async function createReward(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateRewardInput;
  const familyId = req.user!.familyId;

  if (input.type === "CASH" && input.cashValue === undefined) {
    throw AppError.badRequest("cashValue é obrigatório para recompensas do tipo CASH", "VALIDATION_ERROR");
  }

  const reward = await prisma.reward.create({
    data: {
      familyId,
      title: input.title,
      type: input.type,
      pointsCost: input.pointsCost,
      cashValue: input.cashValue,
    },
  });

  res.status(201).json({ reward: serializeReward(reward) });
}

export async function listRewards(req: Request, res: Response): Promise<void> {
  const familyId = req.user!.familyId;
  const rewards = await prisma.reward.findMany({ where: { familyId }, orderBy: { pointsCost: "asc" } });
  res.status(200).json({ rewards: rewards.map(serializeReward) });
}

/** Child claims a reward: automatic approval if pointsBalance >= pointsCost. */
export async function claimReward(req: Request, res: Response): Promise<void> {
  const childId = req.user!.id;
  const familyId = req.user!.familyId;
  const rewardId = req.params.id;

  const reward = await prisma.reward.findFirst({ where: { id: rewardId, familyId } });
  if (!reward) {
    throw AppError.notFound("Recompensa não encontrada", "REWARD_NOT_FOUND");
  }

  const child = await prisma.child.findUnique({ where: { id: childId } });
  if (!child) {
    throw AppError.notFound("Filho não encontrado", "CHILD_NOT_FOUND");
  }

  if (child.pointsBalance < reward.pointsCost) {
    throw AppError.badRequest("Saldo de pontos insuficiente para resgatar esta recompensa", "INSUFFICIENT_POINTS");
  }

  const [, transaction] = await prisma.$transaction([
    prisma.child.update({
      where: { id: child.id },
      data: { pointsBalance: { decrement: reward.pointsCost } },
    }),
    prisma.walletTransaction.create({
      data: {
        childId: child.id,
        type: "REWARD_REDEMPTION",
        points: -reward.pointsCost,
        amount: reward.cashValue ?? undefined,
        description: `Recompensa resgatada: ${reward.title}`,
      },
    }),
  ]);

  res.status(200).json({ reward: serializeReward(reward), transaction: serializeWalletTransaction(transaction) });
}
