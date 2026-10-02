import assert from "node:assert";
import { enforceScope } from "../../dist/auth/authorization.js";
import {
  TenantConnectionRegistry,
  TenantContextManager,
} from "../../dist/auth/tenant-context.js";

console.log("Running Authentication and Scope Authorization Tests...");

const connection1 = {
  tenantId: "merchant-1",
  storeUrl: "https://store1.example.com",
  consumerKey: "ck_test1",
  consumerSecret: "cs_test1",
  authorizedScopes: ["orders:read", "products:read"],
};

const connection2 = {
  tenantId: "merchant-2",
  storeUrl: "https://store2.example.com",
  consumerKey: "ck_test2",
  consumerSecret: "cs_test2",
  authorizedScopes: ["products:read"], // lacking orders:read
};

// 1. Scope enforcement
enforceScope(connection1, "orders:read"); // should pass
enforceScope(connection1, "products:read"); // should pass

assert.throws(
  () => enforceScope(connection2, "orders:read"),
  /FORBIDDEN|Permission denied/,
  "Merchant 2 lacks orders:read scope",
);

// 2. Strict read-only: write scopes are unconditionally rejected
assert.throws(
  () => enforceScope(connection1, "orders:write"),
  /strictly forbidden/,
  "Write scopes must be rejected at runtime",
);

// 3. Tenant isolation in registry
const registry = new TenantConnectionRegistry();
registry.register(connection1);
registry.register(connection2);

assert.strictEqual(registry.get("merchant-1")?.storeUrl, "https://store1.example.com");
assert.strictEqual(registry.get("merchant-2")?.storeUrl, "https://store2.example.com");
assert.strictEqual(registry.get("merchant-3"), undefined, "Unknown tenant returns undefined");

// 4. AsyncLocalStorage context isolation
TenantContextManager.runWithConnection(connection1, () => {
  const active = TenantContextManager.getActiveConnection();
  assert.strictEqual(active.tenantId, "merchant-1");
  assert.strictEqual(active.consumerKey, "ck_test1");

  // Nested context
  TenantContextManager.runWithConnection(connection2, () => {
    const nested = TenantContextManager.getActiveConnection();
    assert.strictEqual(nested.tenantId, "merchant-2");
    assert.strictEqual(nested.consumerKey, "ck_test2");
  });

  // Returns to parent
  assert.strictEqual(TenantContextManager.getActiveConnection().tenantId, "merchant-1");
});

console.log("PASS: Auth and scope tests passed.");
