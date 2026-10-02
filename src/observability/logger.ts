import { redactSecrets, redactSensitiveData } from "../security/redaction.js";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
};

export interface LogContext {
  requestId?: string;
  tenantId?: string;
  toolName?: string;
  durationMs?: number;
  upstreamStatus?: number;
  retryCount?: number;
  rateLimited?: boolean;
  [key: string]: unknown;
}

export class StructuredLogger {
  private level: LogLevel = "INFO";

  constructor(level: LogLevel = "INFO") {
    this.setLevel(level);
  }

  public setLevel(level: LogLevel): void {
    if (LOG_LEVEL_PRIORITY[level] !== undefined) {
      this.level = level;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level];
  }

  private write(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message: redactSecrets(message),
      ...(context ? redactSensitiveData(context) : {}),
    };

    // Stdio MCP protocol requires JSON-RPC on stdout. ALL server logs must go to stderr.
    process.stderr.write(JSON.stringify(entry) + "\n");
  }

  public debug(message: string, context?: LogContext): void {
    this.write("DEBUG", message, context);
  }

  public info(message: string, context?: LogContext): void {
    this.write("INFO", message, context);
  }

  public warn(message: string, context?: LogContext): void {
    this.write("WARN", message, context);
  }

  public error(message: string, context?: LogContext): void {
    this.write("ERROR", message, context);
  }
}

export const logger = new StructuredLogger(
  (process.env.LOG_LEVEL?.toUpperCase() as LogLevel) || "INFO",
);
