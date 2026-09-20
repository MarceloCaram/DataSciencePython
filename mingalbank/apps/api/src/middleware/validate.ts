import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { AppError } from "../lib/errors";

/**
 * Validates `req.body` against a zod schema, replacing it with the parsed
 * (and coerced/defaulted) value on success. On failure throws a 400 AppError
 * with a message listing every offending field.
 */
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
        .join("; ");
      throw AppError.badRequest(message, "VALIDATION_ERROR");
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join(".") || "query"}: ${issue.message}`)
        .join("; ");
      throw AppError.badRequest(message, "VALIDATION_ERROR");
    }
    // Cast through unknown: Express's Request.query type is narrower than
    // the parsed zod output (e.g. optional enum fields).
    req.query = result.data as unknown as Request["query"];
    next();
  };
}
