interface FetchOptions extends RequestInit {
  timeoutMs?: number
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiFetch<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const { timeoutMs = 8000, ...fetchOptions } = options

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new ApiError(`HTTP ${response.status}`, response.status, body)
    }

    return response.json() as Promise<T>
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(`Request timed out after ${timeoutMs}ms`, 408)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}
