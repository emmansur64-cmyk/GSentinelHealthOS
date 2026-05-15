export type ProviderRetryPolicy = {
  max_attempts: number;
  base_delay_ms: number;
  retry_on_status: number[];
};

export const DEFAULT_PROVIDER_RETRY_POLICY: ProviderRetryPolicy = {
  max_attempts: 1,
  base_delay_ms: 250,
  retry_on_status: [408, 429, 500, 502, 503, 504],
};

export async function withProviderRetry<T>(
  operation: (attempt: number) => Promise<T>,
  policy: ProviderRetryPolicy = DEFAULT_PROVIDER_RETRY_POLICY,
): Promise<{ value: T; retry_count: number }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= Math.max(1, policy.max_attempts); attempt += 1) {
    try {
      const value = await operation(attempt);
      return { value, retry_count: attempt - 1 };
    } catch (error) {
      lastError = error;
      if (attempt >= policy.max_attempts) break;
      await new Promise((resolve) => setTimeout(resolve, policy.base_delay_ms * attempt));
    }
  }
  throw lastError;
}
