import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors";
import { verifyAuthToken, type UserRole } from "../lib/jwt";

export interface AuthUser {
  id: string;
  role: UserRole;
  familyId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Verifies the `Authorization: Bearer <jwt>` header and injects
 * `req.user = { id, role, familyId }`. Throws 401 when missing/invalid.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw AppError.unauthorized("Token de autenticação ausente");
  }

  const token = header.slice("Bearer ".length).trim();

  try {
    const payload = verifyAuthToken(token);
    req.user = { id: payload.sub, role: payload.role, familyId: payload.familyId };
    next();
  } catch {
    throw AppError.unauthorized("Token de autenticação inválido ou expirado");
  }
}

/**
 * Restricts a route to one or more roles. Must run after `authenticate`.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw AppError.unauthorized();
    }
    if (!roles.includes(req.user.role)) {
      throw AppError.forbidden("Esta ação não é permitida para o seu perfil");
    }
    next();
  };
}
