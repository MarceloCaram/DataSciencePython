/**
 * Erro "de negócio": o backend respondeu, mas recusou a requisição
 * (401/403/404/400 etc). Isso NUNCA deve cair para o modo mock — é um
 * resultado real que a UI precisa mostrar (ex.: senha errada, PIN inválido).
 */
export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Falha de conectividade (timeout, DNS, servidor fora do ar, offline).
 * É o único caso em que o client cai para os dados mockados locais.
 */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}
