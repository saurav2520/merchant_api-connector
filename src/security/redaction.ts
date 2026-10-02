/**
 * Credential redaction and sanitization utilities.
 * Ensures credentials, API keys, and sensitive tokens are never printed or leaked.
 */

const SENSITIVE_PATTERNS = [
  /ck_[a-zA-Z0-9_-]+/gi,
  /cs_[a-zA-Z0-9_-]+/gi,
  /Bearer\s+[a-zA-Z0-9._~+/-]+=*/gi,
  /Basic\s+[a-zA-Z0-9+/=]+/gi,
  /consumer_key=[^&\s]+/gi,
  /consumer_secret=[^&\s]+/gi,
];

const SENSITIVE_KEY_NAMES = new Set([
  "consumer_key",
  "consumer_secret",
  "key",
  "secret",
  "password",
  "token",
  "authorization",
  "auth",
  "wc_consumer_key",
  "wc_consumer_secret",
]);

/**
 * Redacts known secret patterns from arbitrary strings.
 */
export function redactSecrets(text: string): string {
  if (!text) return text;
  let result = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, (match) => {
      if (match.startsWith("ck_")) return "ck_[REDACTED]";
      if (match.startsWith("cs_")) return "cs_[REDACTED]";
      if (match.toLowerCase().startsWith("bearer ")) return "Bearer [REDACTED]";
      if (match.toLowerCase().startsWith("basic ")) return "Basic [REDACTED]";
      if (match.toLowerCase().startsWith("consumer_key=")) return "consumer_key=[REDACTED]";
      if (match.toLowerCase().startsWith("consumer_secret=")) return "consumer_secret=[REDACTED]";
      return "[REDACTED]";
    });
  }
  return result;
}

/**
 * Deeply redacts sensitive keys from an object or array.
 */
export function redactSensitiveData<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    return redactSecrets(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item)) as unknown as T;
  }

  if (typeof obj === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_KEY_NAMES.has(key.toLowerCase())) {
        cleaned[key] = "[REDACTED]";
      } else {
        cleaned[key] = redactSensitiveData(value);
      }
    }
    return cleaned as T;
  }

  return obj;
}

/**
 * Masks customer emails for minimal PII exposure (e.g. j***e@example.com).
 */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email || typeof email !== "string") return null;
  const parts = email.split("@");
  if (parts.length !== 2) return "[INVALID_EMAIL]";
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local[0] || "*"}*@${domain}`;
  }
  const maskedLocal = `${local[0]}${"*".repeat(Math.min(local.length - 2, 5))}${local[local.length - 1]}`;
  return `${maskedLocal}@${domain}`;
}

/**
 * Strips HTML tags and script fragments to disarm untrusted merchant store content.
 */
export function sanitizePlainText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
