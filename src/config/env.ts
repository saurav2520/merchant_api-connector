import { z } from "zod";

const EnvSchema = z.object({
  WP_URL: z.string().optional(),
  WC_CONSUMER_KEY: z.string().optional(),
  WC_CONSUMER_SECRET: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
  LOG_LEVEL: z.enum(["DEBUG", "INFO", "WARN", "ERROR"]).default("INFO"),
  ALLOW_INSECURE_HTTP: z
    .string()
    .optional()
    .transform((val) => val === "true" || val === "1")
    .default("false"),
  REQUEST_TIMEOUT_MS: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10000))
    .default("10000"),
  MAX_RETRIES: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 2))
    .default("2"),
  RATE_LIMIT_RPS: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .default("10"),
  RATE_LIMIT_BURST: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .default("20"),
  MASK_CUSTOMER_PII: z
    .string()
    .optional()
    .transform((val) => val !== "false")
    .default("true"),
});

export type AppConfig = z.infer<typeof EnvSchema>;

let cachedConfig: AppConfig | null = null;

export function loadAppConfig(overrides?: Partial<AppConfig>): AppConfig {
  if (overrides) {
    return EnvSchema.parse({ ...process.env, ...overrides });
  }
  if (!cachedConfig) {
    cachedConfig = EnvSchema.parse(process.env);
  }
  return cachedConfig;
}

export function resetAppConfig(): void {
  cachedConfig = null;
}
