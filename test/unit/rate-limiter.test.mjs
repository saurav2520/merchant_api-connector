import assert from "node:assert";
import { InMemoryRateLimiter } from "../../dist/security/rate-limiter.js";

console.log("Running Rate Limiter Unit Tests...");

const limiter = new InMemoryRateLimiter({
  defaultRps: 10,
  burstCapacity: 3,
  toolLimits: {
    search_orders: { rps: 2, burst: 2 },
  },
});

// 1. Burst exhaustion
assert.strictEqual(limiter.tryAcquire("tenant-1").allowed, true);
assert.strictEqual(limiter.tryAcquire("tenant-1").allowed, true);
assert.strictEqual(limiter.tryAcquire("tenant-1").allowed, true);

// 4th call should be denied
const denied = limiter.tryAcquire("tenant-1");
assert.strictEqual(denied.allowed, false, "Should be denied after consuming burst");
assert.ok(denied.retryAfterMs && denied.retryAfterMs > 0, "Should provide retryAfterMs");

// 2. Tenant isolation: tenant-2 should still be allowed
assert.strictEqual(
  limiter.tryAcquire("tenant-2").allowed,
  true,
  "Tenant 2 should have independent quota",
);

// 3. Tool specific limit: search_orders has burst of 2
assert.strictEqual(limiter.tryAcquire("tenant-3", "search_orders").allowed, true);
assert.strictEqual(limiter.tryAcquire("tenant-3", "search_orders").allowed, true);
const toolDenied = limiter.tryAcquire("tenant-3", "search_orders");
assert.strictEqual(toolDenied.allowed, false, "Should deny tool after tool burst consumed");

console.log("PASS: Rate limiter unit tests passed.");
