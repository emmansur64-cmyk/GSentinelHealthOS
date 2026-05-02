type ApiErrorPayload = {
  ok?: boolean;
  error?: {
    message?: string;
    details?: unknown;
  };
};

type RetryOptions = {
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
};

type HttpErrorDetails = {
  status: number;
  details?: unknown;
};

export class HttpRequestError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, options: HttpErrorDetails) {
    super(message);
    this.name = "HttpRequestError";
    this.status = options.status;
    this.details = options.details;
  }
}

const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 300;
const DEFAULT_TIMEOUT_MS = 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(status: number): boolean {
  return status === 429 || status >= 500;
}

function withTimeout(signal: AbortSignal | null | undefined, timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  if (signal) {
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  controller.signal.addEventListener(
    "abort",
    () => {
      clearTimeout(timeout);
    },
    { once: true },
  );

  return controller.signal;
}

export async function fetchJsonWithRetry<T>(
  url: string,
  init?: RequestInit,
  options?: RetryOptions,
): Promise<T> {
  const retries = options?.retries ?? DEFAULT_RETRIES;
  const retryDelayMs = options?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
        signal: withTimeout(init?.signal, timeoutMs),
      });

      const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload & { data?: T };

      if (!response.ok || payload.ok === false) {
        const message = payload.error?.message ?? `HTTP ${response.status}`;
        const requestError = new HttpRequestError(message, {
          status: response.status,
          details: payload.error?.details,
        });

        if (attempt < retries && shouldRetry(response.status)) {
          await sleep(retryDelayMs * (attempt + 1));
          continue;
        }

        throw requestError;
      }

      return payload.data as T;
    } catch (error) {
      // Los errores HTTP de cliente (401/403/404/409/422) no se reintentan.
      if (error instanceof HttpRequestError && !shouldRetry(error.status)) {
        throw error;
      }

      lastError = error instanceof Error ? error : new Error("Network error");
      if (attempt >= retries) break;
      await sleep(retryDelayMs * (attempt + 1));
    }
  }

  throw lastError ?? new Error("Request failed");
}
