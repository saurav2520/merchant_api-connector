import assert from "node:assert";
import { OrdersProvider } from "../../dist/providers/woocommerce/orders.js";
import { CircuitBreaker } from "../../dist/resilience/circuit-breaker.js";
import { startMockWooCommerceServer } from "../integration/mock-server.mjs";

console.log("Running Resilience, Rate Limiting, and Fault Tolerance Tests...");

const { server, url } = await startMockWooCommerceServer();

try {
  const conn = {
    tenantId: "resilience-merchant",
    storeUrl: url,
    consumerKey: "ck_valid_test_key",
    consumerSecret: "cs_valid_test_secret",
    authorizedScopes: ["orders:read", "products:read"],
    allowInsecureHttp: true,
  };

  const ordersProvider = new OrdersProvider(conn);
  const client = ordersProvider.client;

  // 1. Upstream 429 simulation
  await assert.rejects(
    async () => client.get("orders", { simulate: "429" }),
    (err) => err.code === "RATE_LIMIT_EXCEEDED" || err.message.includes("Rate limit"),
    "Upstream 429 should throw RateLimitError",
  );

  // 2. Upstream 503 simulation with retries
  await assert.rejects(
    async () => client.get("orders", { simulate: "503" }),
    (err) => err.code === "UPSTREAM_SERVICE_ERROR" || err.message.includes("Service temporarily unavailable"),
    "Upstream 503 should fail after exhausting retries",
  );

  // 3. Malformed JSON response handling
  await assert.rejects(
    async () => client.get("orders", { simulate: "malformed" }),
    (err) => err.code === "UPSTREAM_SERVICE_ERROR" || err.message.includes("Invalid JSON"),
    "Malformed upstream JSON should be caught and converted to safe UpstreamError",
  );

  // 4. Circuit Breaker tripping under consecutive failures
  const testBreaker = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
  testBreaker.recordFailure("faulty-store.local");
  testBreaker.recordFailure("faulty-store.local");
  testBreaker.recordFailure("faulty-store.local");

  assert.throws(
    () => testBreaker.beforeExecute("faulty-store.local"),
    (err) => err.code === "CIRCUIT_BREAKER_OPEN" || err.message.includes("temporarily halted"),
    "Circuit breaker must prevent requests to failing store",
  );

  console.log("PASS: Resilience and fault tolerance tests passed.");
} finally {
  server.close();
}
