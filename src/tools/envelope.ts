import * as crypto from "node:crypto";
import { formatErrorResponse } from "../errors/error-handler.js";
import { logger } from "../observability/logger.js";
import { metrics } from "../observability/metrics.js";
import { NormalizedPagination } from "../providers/woocommerce/types.js";

export interface ToolSuccessEnvelope<T> {
  success: true;
  data: T;
  pagination?: NormalizedPagination;
  provider: "woocommerce";
  request_id: string;
}

export type McpToolResponse = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export function createRequestId(): string {
  return `req_${crypto.randomUUID().slice(0, 12)}`;
}

export function formatSuccessResponse<T>(
  data: T,
  requestId: string,
  pagination?: NormalizedPagination,
): McpToolResponse {
  const envelope: ToolSuccessEnvelope<T> = {
    success: true,
    data,
    provider: "woocommerce",
    request_id: requestId,
  };

  if (pagination) {
    envelope.pagination = pagination;
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(envelope, null, 2),
      },
    ],
  };
}

export function formatFailureResponse(
  error: unknown,
  requestId: string,
  toolName: string,
  tenantId?: string,
): McpToolResponse {
  const formatted = formatErrorResponse(error, requestId);

  logger.error(`Tool execution error: ${toolName}`, {
    toolName,
    tenantId,
    requestId,
    errorCode: formatted.error.code,
    errorMessage: formatted.error.message,
    retryable: formatted.error.retryable,
  });

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(formatted, null, 2),
      },
    ],
    isError: true,
  };
}

/**
 * Wraps a tool execution with performance timing, metric tracking, error boundary and response envelopes.
 */
export async function executeToolSafe<T>(
  toolName: string,
  fn: (requestId: string) => Promise<{ data: T; pagination?: NormalizedPagination }>,
): Promise<McpToolResponse> {
  const requestId = createRequestId();
  const startTime = Date.now();

  try {
    const result = await fn(requestId);
    const durationMs = Date.now() - startTime;
    metrics.recordToolCall(toolName, true, durationMs);
    return formatSuccessResponse(result.data, requestId, result.pagination);
  } catch (error) {
    const durationMs = Date.now() - startTime;
    metrics.recordToolCall(toolName, false, durationMs);
    return formatFailureResponse(error, requestId, toolName);
  }
}
