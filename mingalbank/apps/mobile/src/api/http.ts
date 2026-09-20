import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "./config";
import { ApiError, NetworkError } from "./errors";

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
}

interface BackendErrorShape {
  error?: { code?: string; message?: string };
}

/**
 * Wrapper fino sobre fetch:
 * - injeta `Authorization: Bearer <token>` quando um token é passado;
 * - aplica timeout curto para não travar a UI quando o backend não responde;
 * - erros HTTP do backend (`{ error: { code, message } }`) viram `ApiError`
 *   (falha "de negócio", deve ser mostrada ao usuário);
 * - falhas de rede/timeout viram `NetworkError` (o client tenta o fallback
 *   mock quando recebe esse tipo de erro).
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Falha de rede desconhecida";
    throw new NetworkError(message);
  } finally {
    clearTimeout(timeout);
  }

  let json: unknown = null;
  try {
    const text = await response.text();
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    const shape = (json ?? {}) as BackendErrorShape;
    throw new ApiError(
      shape.error?.message ?? `Erro inesperado (HTTP ${response.status})`,
      shape.error?.code ?? "UNKNOWN_ERROR",
      response.status
    );
  }

  return json as T;
}

/**
 * Executa a chamada real e, apenas em caso de `NetworkError` (backend
 * inalcançável), cai para a implementação mockada local. Erros de negócio
 * (`ApiError`) sempre propagam — nunca são mascarados pelo mock.
 */
export async function withFallback<T>(live: () => Promise<T>, mock: () => Promise<T>): Promise<T> {
  try {
    return await live();
  } catch (error) {
    if (error instanceof NetworkError) {
      if (__DEV__) {
        console.warn(`[api] backend indisponível (${error.message}); usando dados mockados`);
      }
      return await mock();
    }
    throw error;
  }
}
