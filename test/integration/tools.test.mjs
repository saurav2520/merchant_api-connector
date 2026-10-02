import assert from "node:assert";
import { TenantContextManager } from "../../dist/auth/tenant-context.js";
import { OrdersProvider } from "../../dist/providers/woocommerce/orders.js";
import { ProductsProvider } from "../../dist/providers/woocommerce/products.js";
import { startMockWooCommerceServer } from "./mock-server.mjs";

console.log("Running Tool Integration Tests with Mock Store...");

const { server, url } = await startMockWooCommerceServer();

const connection = {
  tenantId: "test-merchant",
  storeUrl: url,
  consumerKey: "ck_valid_test_key",
  consumerSecret: "cs_valid_test_secret",
  authorizedScopes: ["orders:read", "products:read", "customer_pii:read"],
  allowInsecureHttp: true, // test server runs on http://127.0.0.1
};

try {
  await TenantContextManager.runWithConnection(connection, async () => {
    const ordersProvider = new OrdersProvider(connection);
    const productsProvider = new ProductsProvider(connection);

    // 1. list_orders
    const ordersRes = await ordersProvider.listOrders({ per_page: 5 });
    assert.strictEqual(ordersRes.orders.length, 2, "Should return 2 mock orders");
    assert.strictEqual(ordersRes.orders[0].id, 501);
    assert.strictEqual(ordersRes.orders[0].total, "229.49", "Total must be decimal string");
    assert.strictEqual(ordersRes.pagination.total_items, 2);

    // 2. get_order
    const singleOrder = await ordersProvider.getOrder(501);
    assert.strictEqual(singleOrder.id, 501);
    assert.strictEqual(singleOrder.line_items.length, 1);
    assert.strictEqual(singleOrder.line_items[0].price, "199.99");

    // 3. get_order not found
    await assert.rejects(
      async () => ordersProvider.getOrder(9999),
      /ORDER_NOT_FOUND|was not found/,
      "Should throw NotFoundError for nonexistent order",
    );

    // 4. search_orders
    const searchOrdersRes = await ordersProvider.searchOrders({
      status: "completed",
    });
    assert.strictEqual(searchOrdersRes.orders.length, 1);
    assert.strictEqual(searchOrdersRes.orders[0].id, 502);

    // 5. list_products
    const productsRes = await productsProvider.listProducts({ per_page: 5 });
    assert.strictEqual(productsRes.products.length, 3);
    assert.strictEqual(productsRes.products[0].id, 101);
    assert.strictEqual(productsRes.products[0].price, "199.99");
    assert.strictEqual(productsRes.pagination.total_items, 3);

    // 6. get_product
    const singleProduct = await productsProvider.getProduct(102);
    assert.strictEqual(singleProduct.id, 102);
    assert.strictEqual(singleProduct.name, "Cotton Crewneck T-Shirt");
    assert.strictEqual(singleProduct.price, "29.50");

    // 7. get_product not found
    await assert.rejects(
      async () => productsProvider.getProduct(8888),
      /PRODUCT_NOT_FOUND|was not found/,
      "Should throw NotFoundError for nonexistent product",
    );

    // 8. search_products
    const searchProductsRes = await productsProvider.searchProducts({
      search: "leather",
    });
    assert.strictEqual(searchProductsRes.products.length, 1);
    assert.strictEqual(searchProductsRes.products[0].id, 101);
    assert.strictEqual(searchProductsRes.products[0].sku, "JKT-001");
  });

  console.log("PASS: Tool integration tests against mock store passed.");
} finally {
  server.close();
}
