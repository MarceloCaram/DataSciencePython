import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { signAuthToken } from "../../lib/jwt";
import { serializeChild, serializeFamily, serializeParent } from "../../lib/serializers";
import type { LoginChildInput, LoginParentInput, RegisterParentInput, SetChildPinInput } from "./auth.schemas";

const PASSWORD_SALT_ROUNDS = 10;
const PIN_SALT_ROUNDS = 8;

export async function registerParent(req: Request, res: Response): Promise<void> {
  const { familyName, parentName, email, password } = req.body as RegisterParentInput;

  const existing = await prisma.parent.findUnique({ where: { email } });
  if (existing) {
    throw AppError.conflict("Já existe um responsável cadastrado com este email", "EMAIL_IN_USE");
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

  const { family, parent } = await prisma.$transaction(async (tx) => {
    const family = await tx.family.create({ data: { name: familyName } });
    const parent = await tx.parent.create({
      data: { familyId: family.id, name: parentName, email, passwordHash },
    });
    return { family, parent };
  });

  const token = signAuthToken({ sub: parent.id, role: "PARENT", familyId: family.id });

  res.status(201).json({
    token,
    parent: serializeParent(parent),
    family: serializeFamily(family),
  });
}

export async function loginParent(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as LoginParentInput;

  const parent = await prisma.parent.findUnique({ where: { email } });
  if (!parent) {
    throw AppError.unauthorized("Email ou senha inválidos", "INVALID_CREDENTIALS");
  }

  const passwordMatches = await bcrypt.compare(password, parent.passwordHash);
  if (!passwordMatches) {
    throw AppError.unauthorized("Email ou senha inválidos", "INVALID_CREDENTIALS");
  }

  const token = signAuthToken({ sub: parent.id, role: "PARENT", familyId: parent.familyId });

  res.status(200).json({ token, parent: serializeParent(parent) });
}

export async function loginChild(req: Request, res: Response): Promise<void> {
  const { childId, pin } = req.body as LoginChildInput;

  const child = await prisma.child.findUnique({ where: { id: childId } });
  if (!child || !child.pinHash) {
    throw AppError.unauthorized("Credenciais inválidas", "INVALID_CREDENTIALS");
  }

  const pinMatches = await bcrypt.compare(pin, child.pinHash);
  if (!pinMatches) {
    throw AppError.unauthorized("Credenciais inválidas", "INVALID_CREDENTIALS");
  }

  const token = signAuthToken({ sub: child.id, role: "CHILD", familyId: child.familyId });

  res.status(200).json({ token, child: serializeChild(child) });
}

/** Parent-only: creates or resets a child's PIN. */
export async function setChildPin(req: Request, res: Response): Promise<void> {
  const { childId, pin } = req.body as SetChildPinInput;
  const familyId = req.user!.familyId;

  const child = await prisma.child.findFirst({ where: { id: childId, familyId } });
  if (!child) {
    throw AppError.notFound("Filho não encontrado nesta família", "CHILD_NOT_FOUND");
  }

  const pinHash = await bcrypt.hash(pin, PIN_SALT_ROUNDS);
  const updated = await prisma.child.update({ where: { id: childId }, data: { pinHash } });

  res.status(200).json({ child: serializeChild(updated) });
}
