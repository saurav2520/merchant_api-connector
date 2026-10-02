/**
 * In-memory Token Bucket Rate Limiter with tenant and tool-specific quotas.
 */

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

export interface RateLimiterConfig {
  defaultRps: number;
  burstCapacity: number;
  toolLimits?: Record<string, { rps: number; burst: number }>;
}

export class InMemoryRateLimiter {
  private buckets = new Map<string, Bucket>();
  private readonly config: RateLimiterConfig;

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = {
      defaultRps: config.defaultRps ?? 10,
      burstCapacity: config.burstCapacity ?? 20,
      toolLimits: config.toolLimits ?? {
        search_orders: { rps: 3, burst: 5 },
        search_products: { rps: 5, burst: 10 },
      },
    };
  }

  /**
   * Attempt to consume 1 token for a tenant and optional tool.
   * Returns whether the request is allowed and retryAfterMs if denied.
   */
  public tryAcquire(tenantId: string, toolName?: string): { allowed: boolean; retryAfterMs?: number } {
    const now = Date.now();

    // Check tenant general bucket
    const tenantKey = `tenant:${tenantId}`;
    const tenantCheck = this.checkBucket(tenantKey, this.config.defaultRps, this.config.burstCapacity, now);
    if (!tenantCheck.allowed) {
      return tenantCheck;
    }

    // If a tool-specific limit applies, check tool bucket
    if (toolName && this.config.toolLimits && this.config.toolLimits[toolName]) {
      const toolLimit = this.config.toolLimits[toolName];
      const toolKey = `tenant:${tenantId}:tool:${toolName}`;
      const toolCheck = this.checkBucket(toolKey, toolLimit.rps, toolLimit.burst, now);
      if (!toolCheck.allowed) {
        return toolCheck;
      }
    }

    return { allowed: true };
  }

  private checkBucket(
    key: string,
    rps: number,
    burst: number,
    now: number,
  ): { allowed: boolean; retryAfterMs?: number } {
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: burst, lastRefillMs: now };
      this.buckets.set(key, bucket);
    } else {
      // Refill tokens based on elapsed time
      const elapsedSeconds = (now - bucket.lastRefillMs) / 1000;
      const refillAmount = elapsedSeconds * rps;
      bucket.tokens = Math.min(burst, bucket.tokens + refillAmount);
      bucket.lastRefillMs = now;
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true };
    }

    // Calculate time needed to accumulate 1 token
    const neededTokens = 1 - bucket.tokens;
    const retryAfterMs = Math.ceil((neededTokens / rps) * 1000);

    return {
      allowed: false,
      retryAfterMs: Math.max(100, retryAfterMs),
    };
  }

  public reset(): void {
    this.buckets.clear();
  }
}
