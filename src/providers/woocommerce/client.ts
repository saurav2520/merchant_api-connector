import { MerchantConnection } from "../../auth/tenant-context.js";
import { loadAppConfig } from "../../config/env.js";
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  UpstreamError,
} from "../../errors/error-handler.js";
import { logger } from "../../observability/logger.js";
import { metrics } from "../../observability/metrics.js";
import { CircuitBreaker } from "../../resilience/circuit-breaker.js";
import { parseRetryAfter, withRetry } from "../../resilience/retry.js";
import { InMemoryRateLimiter } from "../../security/rate-limiter.js";
import { validateMerchantUrl } from "../../security/url-validation.js";
import { NormalizedPagination } from "./types.js";

const circuitBreaker = new CircuitBreaker();
const rateLimiter = new InMemoryRateLimiter();

export interface WooCommerceApiResponse<T = unknown> {
  data: T;
  pagination?: NormalizedPagination;
}

export class WooCommerceClient {
  private readonly connection: MerchantConnection;
  private readonly config = loadAppConfig();

  constructor(connection: MerchantConnection) {
    this.connection = connection;
  }

  /**
   * Performs an authenticated, validated, rate-limited, and retried GET request to WooCommerce REST API v3.
   */
  public async get<T = unknown>(
    path: string,
    params: Record<string, string | number | boolean | undefined> = {},
    toolName?: string,
  ): Promise<WooCommerceApiResponse<T>> {
    const startTime = Date.now();
    const cleanPath = path.replace(/^\/+/, "");

    // 1. Validate merchant URL and prevent SSRF
    const validatedBase = await validateMerchantUrl(this.connection.storeUrl, {
      allowInsecureHttp: this.connection.allowInsecureHttp ?? this.config.ALLOW_INSECURE_HTTP,
      resolveDns: process.env.NODE_ENV === "production",
    });

    const host = validatedBase.host;

    // 2. Rate limiting check per tenant and tool
    const rateCheck = rateLimiter.tryAcquire(this.connection.tenantId, toolName);
    if (!rateCheck.allowed) {
      metrics.recordRateLimitHit();
      logger.warn("Rate limit exceeded for tenant", {
        tenantId: this.connection.tenantId,
        toolName,
        retryAfterMs: rateCheck.retryAfterMs,
      });
      throw new RateLimitError(
        `Rate limit exceeded for merchant store '${this.connection.tenantId}'. Please try again shortly.`,
        rateCheck.retryAfterMs,
      );
    }

    // 3. Circuit breaker check
    circuitBreaker.beforeExecute(host);

    // 4. Construct request URL
    const targetUrl = new URL(`/wp-json/wc/v3/${cleanPath}`, validatedBase);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        targetUrl.searchParams.set(key, String(value));
      }
    }

    // Use HTTP Basic Auth header rather than query params to prevent credential logging in upstream proxies
    const basicAuth = Buffer.from(
      `${this.connection.consumerKey}:${this.connection.consumerSecret}`,
    ).toString("base64");

    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Basic ${basicAuth}`,
      "User-Agent": "Merchant-AI-Connector/0.1.1",
    };

    let upstreamStatus: number | undefined;
    let attemptsCount = 0;

    try {
      const result = await withRetry(
        async (attempt) => {
          attemptsCount = attempt;
          if (attempt > 0) {
            metrics.recordRetry();
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.config.REQUEST_TIMEOUT_MS);

          let res: Response;
          try {
            res = await fetch(targetUrl, {
              method: "GET", // STRICTLY GET ONLY
              headers,
              signal: controller.signal,
              redirect: "manual", // Prevent blind redirect-following SSRF
            });
          } catch (fetchErr) {
            const isAbort = (fetchErr as Error).name === "AbortError";
            const message = isAbort
              ? `Request timed out after ${this.config.REQUEST_TIMEOUT_MS}ms connecting to ${host}`
              : `Network failure connecting to ${host}: ${(fetchErr as Error).message}`;
            throw new UpstreamError(message, undefined, true);
          } finally {
            clearTimeout(timeoutId);
          }

          upstreamStatus = res.status;

          // Handle HTTP redirect responses safely
          if ([301, 302, 307, 308].includes(res.status)) {
            const redirectLocation = res.headers.get("Location");
            throw new UpstreamError(
              `Store issued unexpected HTTP redirect to '${redirectLocation || "unknown"}'. Automatic redirect following is disabled for security.`,
              res.status,
              false,
            );
          }

          if (!res.ok) {
            let errorDetail = "";
            let errorCode = "";
            try {
              const errorBody = (await res.json()) as { code?: string; message?: string };
              errorCode = errorBody?.code || "";
              errorDetail = errorBody?.message ? `: ${errorBody.message}` : "";
            } catch {
              /* ignore non-JSON error bodies */
            }

            if (res.status === 404) {
              throw new NotFoundError(cleanPath.split("/")[0] || "Resource", cleanPath.split("/")[1] || "id");
            }

            if (res.status === 401) {
              throw new AuthenticationError(
                `WooCommerce authentication failed: Invalid or expired consumer key/secret.`,
              );
            }

            if (res.status === 403) {
              throw new AuthorizationError(
                `WooCommerce rejected access (403 Forbidden). Ensure key has Read permissions.`,
              );
            }

            if (res.status === 429) {
              const retryAfter = parseRetryAfter(res.headers.get("Retry-After"));
              const err = new RateLimitError("WooCommerce store returned 429 Too Many Requests.", retryAfter ?? 5000);
              throw err;
            }

            const isRetryable = [502, 503, 504].includes(res.status);
            throw new UpstreamError(
              `WooCommerce API error ${res.status} ${res.statusText}${errorDetail}`,
              res.status,
              isRetryable,
            );
          }

          let json: T;
          try {
            json = (await res.json()) as T;
          } catch (jsonErr) {
            throw new UpstreamError(`Invalid JSON received from merchant store: ${(jsonErr as Error).message}`, res.status, false);
          }

          // Extract pagination metadata from standard WordPress REST headers
          const totalHeader = res.headers.get("x-wp-total");
          const totalPagesHeader = res.headers.get("x-wp-totalpages");

          let pagination: NormalizedPagination | undefined;
          const pageParam = Number(params.page) || 1;
          const perPageParam = Number(params.per_page) || 10;

          if (totalHeader || totalPagesHeader) {
            pagination = {
              page: pageParam,
              per_page: perPageParam,
              total_items: totalHeader ? parseInt(totalHeader, 10) : undefined,
              total_pages: totalPagesHeader ? parseInt(totalPagesHeader, 10) : undefined,
            };
          }

          return { data: json, pagination };
        },
        {
          maxRetries: this.config.MAX_RETRIES,
          overallTimeoutMs: this.config.REQUEST_TIMEOUT_MS * (this.config.MAX_RETRIES + 1),
          onRetry: (err, attempt, delayMs) => {
            logger.warn(`Retrying request to ${cleanPath}`, {
              attempt,
              delayMs,
              toolName,
              tenantId: this.connection.tenantId,
              error: (err as Error).message,
            });
          },
        },
      );

      circuitBreaker.recordSuccess(host);

      logger.info(`Successfully fetched ${cleanPath}`, {
        toolName,
        tenantId: this.connection.tenantId,
        upstreamStatus: 200,
        durationMs: Date.now() - startTime,
        retryCount: attemptsCount,
      });

      return result;
    } catch (err) {
      circuitBreaker.recordFailure(host);

      logger.error(`Failed request to ${cleanPath}`, {
        toolName,
        tenantId: this.connection.tenantId,
        upstreamStatus,
        durationMs: Date.now() - startTime,
        retryCount: attemptsCount,
        error: (err as Error).message,
      });

      throw err;
    }
  }
}
