// Wraps fetch with a per-attempt timeout and bounded retry on transient
// failures (HTTP 429, 5xx, network errors, and timeouts). A hung request is
// aborted after `timeoutMs`; retries use exponential backoff.

export type FetchRetryOptions = {
  timeoutMs?: number
  maxRetries?: number
  // Base delay for exponential backoff.
  baseDelayMs?: number
}

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_RETRIES = 2
const DEFAULT_BASE_DELAY_MS = 500

export async function fetchWithRetry(
  url: string | URL,
  init: RequestInit,
  options: FetchRetryOptions = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS

  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, {...init, signal: controller.signal})
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        // Discard the body so the connection can be reused, then retry.
        await res.body?.cancel()
        await sleep(retryDelayMs(res, attempt, baseDelayMs))
        continue
      }
      return res
    } catch (err) {
      lastError = err
      if (attempt >= maxRetries) break
      await sleep(backoffMs(attempt, baseDelayMs))
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`fetch failed after ${maxRetries + 1} attempts`)
}

function retryDelayMs(res: Response, attempt: number, baseDelayMs: number): number {
  const retryAfter = res.headers.get('retry-after')
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds)) return seconds * 1000
    const date = Date.parse(retryAfter)
    if (!Number.isNaN(date)) return Math.max(0, date - Date.now())
  }
  return backoffMs(attempt, baseDelayMs)
}

function backoffMs(attempt: number, baseDelayMs: number): number {
  return baseDelayMs * 2 ** attempt + Math.random() * baseDelayMs
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
