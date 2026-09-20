import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { serializeRedemptionRequest, serializeWalletTransaction } from "../../lib/serializers";
import { pointsToCash } from "./constants";
import type { RedeemInput, ReviewRedemptionInput } from "./wallet.schemas";

async function loadChildInScope(req: Request, childId: string) {
  const familyId = req.user!.familyId;

  if (req.user!.role === "CHILD" && req.user!.id !== childId) {
    throw AppError.forbidden("Você só pode acessar sua própria carteira");
  }

  const child = await prisma.child.findFirst({ where: { id: childId, familyId } });
  if (!child) {
    throw AppError.notFound("Filho não encontrado nesta família", "CHILD_NOT_FOUND");
  }
  return child;
}

export async function getWalletSummary(req: Request, res: Response): Promise<void> {
  const child = await loadChildInScope(req, req.params.childId);
  res.status(200).json({
    pointsBalance: child.pointsBalance,
    walletBalance: child.walletBalance,
    currentStreak: child.currentStreak,
    badgeTier: child.badgeTier,
  });
}

export async function getWalletTransactions(req: Request, res: Response): Promise<void> {
  const child = await loadChildInScope(req, req.params.childId);
  const transactions = await prisma.walletTransaction.findMany({
    where: { childId: child.id },
    orderBy: { createdAt: "desc" },
  });
  res.status(200).json({ transactions: transactions.map(serializeWalletTransaction) });
}

export async function requestRedemption(req: Request, res: Response): Promise<void> {
  const { points } = req.body as RedeemInput;
  const child = await loadChildInScope(req, req.params.childId);

  if (req.user!.role !== "CHILD") {
    throw AppError.forbidden("Somente o filho pode solicitar um resgate");
  }
  if (points > child.pointsBalance) {
    throw AppError.badRequest("Saldo de pontos insuficiente para este resgate", "INSUFFICIENT_POINTS");
  }

  const amount = pointsToCash(points);
  const redemption = await prisma.redemptionRequest.create({
    data: { childId: child.id, points, amount, status: "PENDING" },
  });

  res.status(201).json({ redemption: serializeRedemptionRequest(redemption) });
}

export async function reviewRedemption(req: Request, res: Response): Promise<void> {
  const { approve } = req.body as ReviewRedemptionInput;
  const familyId = req.user!.familyId;
  const parentId = req.user!.id;

  const redemption = await prisma.redemptionRequest.findFirst({
    where: { id: req.params.id },
    include: { child: true },
  });
  if (!redemption || redemption.child.familyId !== familyId) {
    throw AppError.notFound("Solicitação de resgate não encontrada", "REDEMPTION_NOT_FOUND");
  }
  if (redemption.status !== "PENDING") {
    throw AppError.conflict("Esta solicitação já foi revisada", "REDEMPTION_ALREADY_REVIEWED");
  }

  const reviewedAt = new Date();

  if (!approve) {
    const updated = await prisma.redemptionRequest.update({
      where: { id: redemption.id },
      data: { status: "REJECTED", reviewedAt, reviewedByParentId: parentId },
    });
    res.status(200).json({ redemption: serializeRedemptionRequest(updated) });
    return;
  }

  if (redemption.points > redemption.child.pointsBalance) {
    throw AppError.conflict(
      "O filho não possui mais pontos suficientes para este resgate",
      "INSUFFICIENT_POINTS",
    );
  }

  const [updatedRedemption] = await prisma.$transaction([
    prisma.redemptionRequest.update({
      where: { id: redemption.id },
      data: { status: "APPROVED", reviewedAt, reviewedByParentId: parentId },
    }),
    prisma.child.update({
      where: { id: redemption.child.id },
      data: {
        pointsBalance: { decrement: redemption.points },
        walletBalance: { increment: redemption.amount },
      },
    }),
    prisma.walletTransaction.create({
      data: {
        childId: redemption.child.id,
        type: "REDEMPTION",
        points: -redemption.points,
        amount: redemption.amount,
        description: `Resgate de ${redemption.points} pontos por R$ ${redemption.amount.toFixed(2)}`,
      },
    }),
  ]);

  res.status(200).json({ redemption: serializeRedemptionRequest(updatedRedemption) });
}
