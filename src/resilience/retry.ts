import { UpstreamError } from "../errors/error-handler.js";

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  overallTimeoutMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BASE_DELAY_MS = 300;
const DEFAULT_MAX_DELAY_MS = 3000;
const DEFAULT_OVERALL_TIMEOUT_MS = 25000;

/**
 * Checks if an error represents a transient failure eligible for retry.
 */
export function isTransientError(error: unknown): boolean {
  if (error instanceof UpstreamError) {
    if (error.upstreamStatus !== undefined) {
      // 429, 502, 503, 504 are transient
      return [429, 502, 503, 504].includes(error.upstreamStatus);
    }
    return error.retryable;
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // Network timeouts, socket resets, connection refused
    if (
      msg.includes("abort") ||
      msg.includes("timeout") ||
      msg.includes("econnreset") ||
      msg.includes("econnrefused") ||
      msg.includes("etimedout") ||
      msg.includes("fetch failed") ||
      msg.includes("undici")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Parses Retry-After header value (either seconds or HTTP-Date) into milliseconds.
 */
export function parseRetryAfter(headerValue: string | null | undefined): number | null {
  if (!headerValue) return null;
  const seconds = Number(headerValue);
  if (!isNaN(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const dateMs = Date.parse(headerValue);
  if (!isNaN(dateMs)) {
    const diff = dateMs - Date.now();
    return diff > 0 ? diff : 0;
  }

  return null;
}

/**
 * Executes an operation with bounded exponential backoff retry and overall deadline.
 */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const overallTimeoutMs = options.overallTimeoutMs ?? DEFAULT_OVERALL_TIMEOUT_MS;
  const shouldRetry = options.shouldRetry ?? isTransientError;

  const startTime = Date.now();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      const isLastAttempt = attempt >= maxRetries;
      const elapsedTime = Date.now() - startTime;

      if (isLastAttempt || elapsedTime >= overallTimeoutMs || !shouldRetry(error, attempt)) {
        throw error;
      }

      // Calculate exponential backoff delay with full jitter
      const expDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
      const jitter = Math.random() * expDelay * 0.3; // 30% jitter
      let delayMs = expDelay + jitter;

      // Check if Retry-After was provided on UpstreamError
      if (error && typeof error === "object" && "retryAfterMs" in error) {
        const ra = (error as { retryAfterMs?: number }).retryAfterMs;
        if (typeof ra === "number" && ra > 0) {
          delayMs = Math.min(maxDelayMs, ra);
        }
      }

      // Check if remaining overall timeout allows this delay
      if (elapsedTime + delayMs >= overallTimeoutMs) {
        throw error;
      }

      if (options.onRetry) {
        options.onRetry(error, attempt + 1, delayMs);
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error("Retry loop terminated unexpectedly.");
}
