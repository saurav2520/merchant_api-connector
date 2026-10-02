import { CircuitBreakerOpenError } from "../errors/error-handler.js";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
  failureThreshold: number; // Consecutive failures before tripping
  resetTimeoutMs: number; // Duration to remain open before half-open probe
  successThreshold: number; // Consecutive successes in half-open before closing
}

interface CircuitStateInfo {
  state: CircuitState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTime: number;
}

export class CircuitBreaker {
  private circuits = new Map<string, CircuitStateInfo>();
  private readonly config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      resetTimeoutMs: config.resetTimeoutMs ?? 30000,
      successThreshold: config.successThreshold ?? 2,
    };
  }

  public getState(key: string): CircuitState {
    const info = this.circuits.get(key);
    if (!info) return "CLOSED";

    if (info.state === "OPEN") {
      const now = Date.now();
      if (now - info.lastFailureTime >= this.config.resetTimeoutMs) {
        info.state = "HALF_OPEN";
        info.consecutiveSuccesses = 0;
        return "HALF_OPEN";
      }
    }

    return info.state;
  }

  public beforeExecute(key: string): void {
    const state = this.getState(key);
    if (state === "OPEN") {
      const info = this.circuits.get(key)!;
      const elapsed = Date.now() - info.lastFailureTime;
      const remainingSeconds = Math.max(1, Math.ceil((this.config.resetTimeoutMs - elapsed) / 1000));
      throw new CircuitBreakerOpenError(key, remainingSeconds);
    }
  }

  public recordSuccess(key: string): void {
    const info = this.circuits.get(key);
    if (!info) return;

    if (info.state === "HALF_OPEN") {
      info.consecutiveSuccesses += 1;
      if (info.consecutiveSuccesses >= this.config.successThreshold) {
        info.state = "CLOSED";
        info.consecutiveFailures = 0;
        info.consecutiveSuccesses = 0;
      }
    } else if (info.state === "CLOSED") {
      info.consecutiveFailures = 0;
    }
  }

  public recordFailure(key: string): void {
    let info = this.circuits.get(key);
    const now = Date.now();

    if (!info) {
      info = {
        state: "CLOSED",
        consecutiveFailures: 1,
        consecutiveSuccesses: 0,
        lastFailureTime: now,
      };
      this.circuits.set(key, info);
    } else {
      info.consecutiveFailures += 1;
      info.lastFailureTime = now;
    }

    if (info.state === "HALF_OPEN" || info.consecutiveFailures >= this.config.failureThreshold) {
      info.state = "OPEN";
      info.consecutiveSuccesses = 0;
    }
  }

  public reset(key?: string): void {
    if (key) {
      this.circuits.delete(key);
    } else {
      this.circuits.clear();
    }
  }
}
