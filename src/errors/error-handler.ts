/**
 * Standardized error handling for Merchant AI Connector.
 * Ensures error messages are safe, structured, and do not leak credentials or stack traces.
 */

export class ConnectorError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly retryable: boolean;
  public readonly isConnectorError = true;

  constructor(message: string, code: string = "INTERNAL_ERROR", statusCode: number = 500, retryable: boolean = false) {
    super(message);
    this.name = "ConnectorError";
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends ConnectorError {
  constructor(resource: string, id: string | number) {
    super(`${resource} with ID '${id}' was not found.`, `${resource.toUpperCase()}_NOT_FOUND`, 404, false);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends ConnectorError {
  constructor(message: string, details?: unknown) {
    super(message, "INVALID_INPUT", 400, false);
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends ConnectorError {
  constructor(message: string = "Merchant authentication failed or credentials missing.") {
    super(message, "AUTHENTICATION_FAILED", 401, false);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends ConnectorError {
  constructor(message: string = "Action not authorized for this merchant connection.") {
    super(message, "ACCESS_FORBIDDEN", 403, false);
    this.name = "AuthorizationError";
  }
}

export class SecurityError extends ConnectorError {
  constructor(message: string, code: string = "SECURITY_VIOLATION") {
    super(message, code, 403, false);
    this.name = "SecurityError";
  }
}

export class RateLimitError extends ConnectorError {
  public readonly retryAfterMs: number;

  constructor(message: string, retryAfterMs: number = 5000) {
    super(message, "RATE_LIMIT_EXCEEDED", 429, true);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

export class UpstreamError extends ConnectorError {
  public readonly upstreamStatus?: number;

  constructor(message: string, upstreamStatus?: number, retryable: boolean = false) {
    const isRetryable = retryable || (upstreamStatus !== undefined && [429, 502, 503, 504].includes(upstreamStatus));
    super(message, "UPSTREAM_SERVICE_ERROR", upstreamStatus && upstreamStatus < 500 ? upstreamStatus : 502, isRetryable);
    this.name = "UpstreamError";
    this.upstreamStatus = upstreamStatus;
  }
}

export class CircuitBreakerOpenError extends ConnectorError {
  constructor(host: string, resetInSeconds: number) {
    super(
      `Upstream connection to '${host}' temporarily halted due to consecutive failures. Try again in ${resetInSeconds}s.`,
      "CIRCUIT_BREAKER_OPEN",
      503,
      true,
    );
    this.name = "CircuitBreakerOpenError";
  }
}

export interface StandardErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    request_id: string;
    details?: unknown;
  };
}

/**
 * Format any thrown error into a safe, normalized response.
 * Never exposes stack traces, credentials, or raw internal exceptions.
 */
export function formatErrorResponse(err: unknown, requestId: string): StandardErrorResponse {
  if (err instanceof ConnectorError) {
    return {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        retryable: err.retryable,
        request_id: requestId,
      },
    };
  }

  const message = err instanceof Error ? err.message : String(err);

  // Redact potential leaked tokens or URLs in unexpected messages
  const sanitizedMessage = message
    .replace(/ck_[a-zA-Z0-9_-]+/g, "ck_[REDACTED]")
    .replace(/cs_[a-zA-Z0-9_-]+/g, "cs_[REDACTED]")
    .replace(/consumer_secret=[^&]+/g, "consumer_secret=[REDACTED]")
    .replace(/consumer_key=[^&]+/g, "consumer_key=[REDACTED]");

  return {
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: sanitizedMessage || "An unexpected error occurred processing the request.",
      retryable: false,
      request_id: requestId,
    },
  };
}
