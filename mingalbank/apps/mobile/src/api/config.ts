/**
 * Base URL configurável via variável de ambiente pública do Expo.
 * Ver README.md para como apontar para o backend local
 * (`EXPO_PUBLIC_API_URL=http://localhost:3333/api/v1`).
 *
 * Sem a variável definida, cai no default do contrato (docs/API_CONTRACT.md).
 * Em qualquer caso, se o servidor não responder a tempo o client cai
 * automaticamente para os dados mockados locais (ver src/api/mock.ts).
 */
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "") ||
  "http://localhost:3333/api/v1"
);

/** Tempo máximo de espera por uma resposta antes de cair no fallback mock. */
export const REQUEST_TIMEOUT_MS = 4000;

/** Simula latência de rede realista no modo mock, sem travar a UI. */
export const MOCK_LATENCY_MS = 250;
