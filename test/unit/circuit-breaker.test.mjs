import assert from "node:assert";
import { CircuitBreaker } from "../../dist/resilience/circuit-breaker.js";

console.log("Running Circuit Breaker Unit Tests...");

const breaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeoutMs: 150, // fast reset for test
  successThreshold: 1,
});

const hostA = "store-a.example.com";
const hostB = "store-b.example.com";

// 1. Initial state
assert.strictEqual(breaker.getState(hostA), "CLOSED");
breaker.beforeExecute(hostA); // should not throw

// 2. Failures up to threshold
breaker.recordFailure(hostA);
breaker.recordFailure(hostA);
assert.strictEqual(breaker.getState(hostA), "CLOSED");

breaker.recordFailure(hostA); // 3rd failure trips
assert.strictEqual(breaker.getState(hostA), "OPEN");

// 3. Trying to execute while OPEN should throw
assert.throws(
  () => breaker.beforeExecute(hostA),
  (err) => err.code === "CIRCUIT_BREAKER_OPEN" || err.message.includes("temporarily halted"),
  "Should throw CircuitBreakerOpenError when OPEN",
);

// 4. Host B should still be CLOSED (isolation)
assert.strictEqual(breaker.getState(hostB), "CLOSED");
breaker.beforeExecute(hostB);

// 5. Half-open and recovery
await new Promise((r) => setTimeout(r, 160));
assert.strictEqual(breaker.getState(hostA), "HALF_OPEN");

breaker.recordSuccess(hostA);
assert.strictEqual(breaker.getState(hostA), "CLOSED", "Should return to CLOSED after success in HALF_OPEN");

console.log("PASS: Circuit breaker unit tests passed.");
