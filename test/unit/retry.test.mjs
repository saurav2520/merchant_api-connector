import assert from "node:assert";
import { UpstreamError } from "../../dist/errors/error-handler.js";
import { isTransientError, parseRetryAfter, withRetry } from "../../dist/resilience/retry.js";

console.log("Running Retry Unit Tests...");

// 1. isTransientError
assert.strictEqual(isTransientError(new UpstreamError("Server error", 503)), true);
assert.strictEqual(isTransientError(new UpstreamError("Rate limited", 429)), true);
assert.strictEqual(isTransientError(new UpstreamError("Bad gateway", 502)), true);
assert.strictEqual(isTransientError(new UpstreamError("Auth error", 401)), false);
assert.strictEqual(isTransientError(new UpstreamError("Forbidden", 403)), false);
assert.strictEqual(isTransientError(new UpstreamError("Not found", 404)), false);
assert.strictEqual(isTransientError(new UpstreamError("Bad request", 400)), false);
assert.strictEqual(isTransientError(new Error("fetch failed: socket hang up")), true);

// 2. parseRetryAfter
assert.strictEqual(parseRetryAfter("5"), 5000);
assert.strictEqual(parseRetryAfter("0"), 0);
assert.strictEqual(parseRetryAfter(null), null);

// 3. withRetry succeeds after transient failure
let attempts = 0;
const result = await withRetry(
  async (attempt) => {
    attempts++;
    if (attempt === 0) {
      throw new UpstreamError("Temporary 503", 503);
    }
    return "success-data";
  },
  { maxRetries: 2, baseDelayMs: 20 },
);

assert.strictEqual(result, "success-data");
assert.strictEqual(attempts, 2, "Should succeed on second attempt");

// 4. withRetry does NOT retry non-transient error (e.g. 401)
let nonTransientAttempts = 0;
await assert.rejects(
  async () => {
    await withRetry(
      async () => {
        nonTransientAttempts++;
        throw new UpstreamError("Unauthorized", 401);
      },
      { maxRetries: 2, baseDelayMs: 20 },
    );
  },
  /Unauthorized/,
);
assert.strictEqual(nonTransientAttempts, 1, "Should fail immediately without retry on non-transient error");

console.log("PASS: Retry unit tests passed.");
