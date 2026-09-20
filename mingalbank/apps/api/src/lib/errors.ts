/**
 * Standardized application error. Every route handler that fails a business
 * rule (not found, forbidden, invalid input, etc.) should throw one of these
 * so the central error handler can format it as
 *   { error: { code, message } }
 * with the matching HTTP status, per docs/API_CONTRACT.md.
 */
export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = "AppError";
  }

  static badRequest(message: string, code = "BAD_REQUEST") {
    return new AppError(400, code, message);
  }

  static unauthorized(message = "Não autenticado", code = "UNAUTHORIZED") {
    return new AppError(401, code, message);
  }

  static forbidden(message = "Sem permissão", code = "FORBIDDEN") {
    return new AppError(403, code, message);
  }

  static notFound(message = "Recurso não encontrado", code = "NOT_FOUND") {
    return new AppError(404, code, message);
  }

  static conflict(message: string, code = "CONFLICT") {
    return new AppError(409, code, message);
  }
}
