import assert from "node:assert";
import { TenantContextManager } from "../../dist/auth/tenant-context.js";
import { createServer, VERSION } from "../../dist/index.js";
import { startMockWooCommerceServer } from "../integration/mock-server.mjs";

console.log("Running MCP Protocol & Tool Execution Tests...");

const { server: mockServer, url } = await startMockWooCommerceServer();

try {
  const server = createServer();
  assert.ok(server, "McpServer was created");

  const reg = server._registeredTools ?? server.server?._registeredTools ?? {};
  const toolNames = Object.keys(reg);

  const expectedTools = [
    "list_orders",
    "get_order",
    "search_orders",
    "list_products",
    "get_product",
    "search_products",
  ];

  for (const name of expectedTools) {
    assert.ok(toolNames.includes(name), `Expected tool ${name} to be registered`);
  }

  // Set active connection for tool execution test
  const conn = {
    tenantId: "mcp-test-merchant",
    storeUrl: url,
    consumerKey: "ck_valid",
    consumerSecret: "cs_valid",
    authorizedScopes: ["orders:read", "products:read"],
    allowInsecureHttp: true,
  };

  await TenantContextManager.runWithConnection(conn, async () => {
    // Execute list_products tool handler
    const listProductsTool = reg["list_products"];
    assert.ok(listProductsTool, "list_products tool found");

    const result = await listProductsTool.handler({ per_page: 2 });
    assert.ok(result.content && result.content.length > 0, "Tool must return text content");

    const parsed = JSON.parse(result.content[0].text);
    assert.strictEqual(parsed.success, true, "Response must indicate success");
    assert.strictEqual(parsed.provider, "woocommerce", "Provider must be woocommerce");
    assert.ok(parsed.request_id && parsed.request_id.startsWith("req_"), "Must contain request_id");
    assert.ok(Array.isArray(parsed.data), "Data must be an array of products");
    assert.strictEqual(parsed.data.length, 2);
    assert.strictEqual(parsed.data[0].id, 101);
    assert.strictEqual(parsed.data[0].price, "199.99");
  });

  console.log("PASS: MCP protocol and tool execution tests passed.");
} finally {
  mockServer.close();
}
