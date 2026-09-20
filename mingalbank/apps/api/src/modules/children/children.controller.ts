import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { serializeChild } from "../../lib/serializers";
import type { CreateChildInput, UpdateChildInput } from "./children.schemas";

export async function createChild(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateChildInput;
  const familyId = req.user!.familyId;

  const child = await prisma.child.create({
    data: {
      familyId,
      name: input.name,
      birthDate: input.birthDate,
      photoUrl: input.photoUrl,
      trustLevel: input.trustLevel,
      allowanceValue: input.allowanceValue,
      allowancePeriod: input.allowancePeriod,
    },
  });

  res.status(201).json({ child: serializeChild(child) });
}

export async function listChildren(req: Request, res: Response): Promise<void> {
  const familyId = req.user!.familyId;
  const children = await prisma.child.findMany({ where: { familyId }, orderBy: { createdAt: "asc" } });
  res.status(200).json({ children: children.map(serializeChild) });
}

/** GET /children/me — a logged-in child fetching their own profile. */
export async function getOwnChild(req: Request, res: Response): Promise<void> {
  const child = await prisma.child.findUnique({ where: { id: req.user!.id } });
  if (!child) {
    throw AppError.notFound("Filho não encontrado", "CHILD_NOT_FOUND");
  }
  res.status(200).json({ child: serializeChild(child) });
}

export async function getChild(req: Request, res: Response): Promise<void> {
  const familyId = req.user!.familyId;
  const child = await prisma.child.findFirst({ where: { id: req.params.id, familyId } });
  if (!child) {
    throw AppError.notFound("Filho não encontrado nesta família", "CHILD_NOT_FOUND");
  }
  res.status(200).json({ child: serializeChild(child) });
}

export async function updateChild(req: Request, res: Response): Promise<void> {
  const familyId = req.user!.familyId;
  const input = req.body as UpdateChildInput;

  const existing = await prisma.child.findFirst({ where: { id: req.params.id, familyId } });
  if (!existing) {
    throw AppError.notFound("Filho não encontrado nesta família", "CHILD_NOT_FOUND");
  }

  const updated = await prisma.child.update({ where: { id: existing.id }, data: input });
  res.status(200).json({ child: serializeChild(updated) });
}
