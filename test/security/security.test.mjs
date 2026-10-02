import assert from "node:assert";
import { enforceScope } from "../../dist/auth/authorization.js";
import { TenantContextManager } from "../../dist/auth/tenant-context.js";
import { formatErrorResponse } from "../../dist/errors/error-handler.js";
import { OrdersProvider } from "../../dist/providers/woocommerce/orders.js";
import { ProductsProvider } from "../../dist/providers/woocommerce/products.js";
import { validateMerchantUrl } from "../../dist/security/url-validation.js";
import { startMockWooCommerceServer } from "../integration/mock-server.mjs";

console.log("Running Security and Vulnerability Tests...");

const { server, url } = await startMockWooCommerceServer();

try {
  // 1. Invalid credentials -> 401 AuthenticationError
  const badCredsConn = {
    tenantId: "bad-creds-merchant",
    storeUrl: url,
    consumerKey: "invalid_key",
    consumerSecret: "invalid_secret",
    authorizedScopes: ["orders:read", "products:read"],
    allowInsecureHttp: true,
  };

  const badOrdersProvider = new OrdersProvider(badCredsConn);
  await assert.rejects(
    async () => badOrdersProvider.listOrders(),
    /AUTHENTICATION_FAILED|authentication failed/,
    "Invalid credentials should map to AUTHENTICATION_FAILED without leaking raw secret",
  );

  // 2. Forbidden Scope -> 403
  const forbiddenConn = {
    tenantId: "forbidden-merchant",
    storeUrl: url,
    consumerKey: "forbidden_key",
    consumerSecret: "cs_any",
    authorizedScopes: ["orders:read", "products:read"],
    allowInsecureHttp: true,
  };
  const forbiddenProvider = new OrdersProvider(forbiddenConn);
  await assert.rejects(
    async () => forbiddenProvider.listOrders(),
    /ACCESS_FORBIDDEN|rejected access/,
    "Forbidden scope should map to ACCESS_FORBIDDEN",
  );

  // 3. Write attempts are unconditionally rejected
  assert.throws(
    () => enforceScope(badCredsConn, "orders:write"),
    /strictly forbidden/,
    "Write operations must be rejected at authorization guard",
  );

  // 4. Invalid input validation: IDs must be positive integers
  const validConn = {
    tenantId: "valid-merchant",
    storeUrl: url,
    consumerKey: "ck_valid",
    consumerSecret: "cs_valid",
    authorizedScopes: ["orders:read", "products:read"],
    allowInsecureHttp: true,
  };
  const ordersProvider = new OrdersProvider(validConn);
  const productsProvider = new ProductsProvider(validConn);

  await assert.rejects(
    async () => ordersProvider.getOrder(-5),
    /INVALID_INPUT|positive integer/,
    "Negative order ID must be rejected",
  );
  await assert.rejects(
    async () => ordersProvider.getOrder(0),
    /INVALID_INPUT|positive integer/,
    "Zero order ID must be rejected",
  );
  await assert.rejects(
    async () => productsProvider.getProduct(-1),
    /INVALID_INPUT|positive integer/,
    "Negative product ID must be rejected",
  );

  // 5. Invalid date ranges
  await assert.rejects(
    async () => ordersProvider.searchOrders({ after: "not-a-date" }),
    /INVALID_INPUT|valid ISO 8601 date/,
    "Malformed date must be rejected",
  );

  await assert.rejects(
    async () => ordersProvider.searchOrders({
      after: "2026-06-01T00:00:00Z",
      before: "2026-01-01T00:00:00Z",
    }),
    /INVALID_INPUT|must be before/,
    "Inverted date range must be rejected",
  );

  // 6. Secret leakage in error responses
  const leakedError = new Error("Failed reaching store with key ck_my_secret_key_12345 and cs_secret_9999");
  const formatted = formatErrorResponse(leakedError, "req-123");
  assert.strictEqual(formatted.error.message.includes("ck_my_secret_key_12345"), false, "Error message must not contain raw consumer key");
  assert.strictEqual(formatted.error.message.includes("cs_secret_9999"), false, "Error message must not contain raw consumer secret");
  assert.strictEqual(formatted.error.message.includes("ck_[REDACTED]"), true, "Key should be redacted");

  // 7. SSRF Protection: Loopback and metadata IPs
  await assert.rejects(
    async () => validateMerchantUrl("https://169.254.169.254/latest/meta-data"),
    (err) => err.code === "SSRF_PRIVATE_IP" || err.message.includes("prohibited"),
    "Should block AWS/cloud metadata address",
  );

  await assert.rejects(
    async () => validateMerchantUrl("https://10.0.0.1/admin"),
    (err) => err.code === "SSRF_PRIVATE_IP" || err.message.includes("prohibited"),
    "Should block private RFC1918 address",
  );

  console.log("PASS: Security and vulnerability tests passed.");
} finally {
  server.close();
}
