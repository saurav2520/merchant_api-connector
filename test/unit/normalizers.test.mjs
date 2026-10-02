import assert from "node:assert";
import {
  normalizeOrder,
  normalizeProduct,
  toDecimalString,
} from "../../dist/providers/woocommerce/normalizers.js";

console.log("Running Normalizers Unit Tests...");

// 1. toDecimalString tests
assert.strictEqual(toDecimalString(19.99), "19.99");
assert.strictEqual(toDecimalString("45.5"), "45.50");
assert.strictEqual(toDecimalString(0), "0.00");
assert.strictEqual(toDecimalString(null), "0.00");
assert.strictEqual(toDecimalString(undefined), "0.00");
assert.strictEqual(toDecimalString("invalid"), "0.00");
assert.strictEqual(toDecimalString(100), "100.00");

// 2. normalizeProduct tests
const rawProduct = {
  id: 101,
  name: "Premium Cotton T-Shirt",
  slug: "premium-cotton-t-shirt",
  permalink: "https://store.example.com/product/t-shirt",
  sku: "TSHIRT-001",
  price: "24.99",
  regular_price: 29.99,
  sale_price: "24.99",
  on_sale: true,
  stock_status: "instock",
  stock_quantity: 45,
  manage_stock: true,
  description: "<p>Best quality <script>alert(1)</script> cotton shirt &amp; durable.</p>",
  short_description: "<strong>Soft and stylish</strong>",
  categories: [{ id: 12, name: "Apparel", slug: "apparel" }],
  images: [{ id: 1, src: "https://store.example.com/img.jpg", alt: "Shirt" }],
  date_created: "2026-01-15T10:00:00",
};

const normProduct = normalizeProduct(rawProduct);
assert.strictEqual(normProduct.id, 101);
assert.strictEqual(normProduct.name, "Premium Cotton T-Shirt");
assert.strictEqual(normProduct.price, "24.99");
assert.strictEqual(normProduct.regular_price, "29.99");
assert.strictEqual(normProduct.sale_price, "24.99");
assert.strictEqual(normProduct.stock_status, "instock");
assert.strictEqual(normProduct.stock_quantity, 45);
assert.strictEqual(normProduct.description.includes("<script>"), false, "HTML script tags should be disarmed");
assert.strictEqual(normProduct.description.includes("cotton shirt & durable"), true, "Decoded content preserved");
assert.strictEqual(normProduct.short_description, "Soft and stylish", "Tags stripped");

// 3. normalizeOrder tests
const rawOrder = {
  id: 5001,
  number: "5001",
  status: "processing",
  currency: "USD",
  date_created: "2026-02-10T14:30:00",
  date_modified: "2026-02-10T14:35:00",
  total: "54.98",
  discount_total: "0.00",
  shipping_total: "5.00",
  total_tax: "4.99",
  payment_method_title: "Credit Card (Stripe)",
  customer_id: 88,
  billing: {
    first_name: "Jane",
    last_name: "Doe",
    email: "jane.doe@example.com",
    city: "Seattle",
    state: "WA",
    country: "US",
    postcode: "98101",
  },
  shipping: {
    city: "Seattle",
    state: "WA",
    country: "US",
    postcode: "98101",
  },
  line_items: [
    {
      id: 10,
      name: "Premium Cotton T-Shirt",
      product_id: 101,
      variation_id: 0,
      quantity: 2,
      subtotal: "49.98",
      total: "49.98",
      sku: "TSHIRT-001",
      price: "24.99",
    },
  ],
};

const maskedOrder = normalizeOrder(rawOrder, true);
assert.strictEqual(maskedOrder.id, 5001);
assert.strictEqual(maskedOrder.total, "54.98");
assert.strictEqual(maskedOrder.customer_email, "j*****e@example.com", "Email should be masked for PII protection");
assert.strictEqual(maskedOrder.item_count, 2);
assert.strictEqual(maskedOrder.line_items[0].price, "24.99");
assert.strictEqual(maskedOrder.billing.first_name, undefined, "Direct PII names not exposed in minimal billing");

const unmaskedOrder = normalizeOrder(rawOrder, false);
assert.strictEqual(unmaskedOrder.customer_email, "jane.doe@example.com", "Email intact when masking disabled");

console.log("PASS: Normalizers unit tests passed.");
