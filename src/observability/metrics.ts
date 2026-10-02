/**
 * Basic in-memory metrics collector for tool executions, retries, and errors.
 */

export interface MetricSnapshot {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitHits: number;
  retriesTotal: number;
  circuitBreakerTrips: number;
  toolUsage: Record<string, { total: number; success: number; failures: number; avgLatencyMs: number }>;
}

export class MetricsCollector {
  private totalRequests = 0;
  private successfulRequests = 0;
  private failedRequests = 0;
  private rateLimitHits = 0;
  private retriesTotal = 0;
  private circuitBreakerTrips = 0;

  private toolStats = new Map<
    string,
    { total: number; success: number; failures: number; totalDurationMs: number }
  >();

  public recordToolCall(toolName: string, success: boolean, durationMs: number): void {
    this.totalRequests++;
    if (success) {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
    }

    let stat = this.toolStats.get(toolName);
    if (!stat) {
      stat = { total: 0, success: 0, failures: 0, totalDurationMs: 0 };
      this.toolStats.set(toolName, stat);
    }

    stat.total++;
    if (success) stat.success++;
    else stat.failures++;
    stat.totalDurationMs += durationMs;
  }

  public recordRateLimitHit(): void {
    this.rateLimitHits++;
  }

  public recordRetry(): void {
    this.retriesTotal++;
  }

  public recordCircuitBreakerTrip(): void {
    this.circuitBreakerTrips++;
  }

  public getSnapshot(): MetricSnapshot {
    const toolUsage: MetricSnapshot["toolUsage"] = {};
    for (const [tool, stat] of this.toolStats.entries()) {
      toolUsage[tool] = {
        total: stat.total,
        success: stat.success,
        failures: stat.failures,
        avgLatencyMs: stat.total > 0 ? Math.round(stat.totalDurationMs / stat.total) : 0,
      };
    }

    return {
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      rateLimitHits: this.rateLimitHits,
      retriesTotal: this.retriesTotal,
      circuitBreakerTrips: this.circuitBreakerTrips,
      toolUsage,
    };
  }

  public reset(): void {
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.rateLimitHits = 0;
    this.retriesTotal = 0;
    this.circuitBreakerTrips = 0;
    this.toolStats.clear();
  }
}

export const metrics = new MetricsCollector();
