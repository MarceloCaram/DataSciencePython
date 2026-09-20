import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import type { UpdateFamilySettingsInput } from "./family.schemas";

/**
 * Configurações de gamificação da família — hoje só o multiplicador de fim
 * de semana (PRD §4: "Bônus: Multiplicador no fim de semana (1.5x) ...
 * customizável"). Parent-only.
 */
export async function getSettings(req: Request, res: Response): Promise<void> {
  const familyId = req.user!.familyId;

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { weekendMultiplier: true },
  });
  if (!family) {
    throw AppError.notFound("Família não encontrada", "FAMILY_NOT_FOUND");
  }

  res.status(200).json({ weekendMultiplier: family.weekendMultiplier });
}

export async function updateSettings(req: Request, res: Response): Promise<void> {
  const familyId = req.user!.familyId;
  const { weekendMultiplier } = req.body as UpdateFamilySettingsInput;

  const family = await prisma.family.update({
    where: { id: familyId },
    data: { weekendMultiplier },
  });

  res.status(200).json({ weekendMultiplier: family.weekendMultiplier });
}
