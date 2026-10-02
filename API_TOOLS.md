# Merchant AI Connector - MCP Tool Reference

Merchant AI Connector registers 6 secure, read-only MCP tools for retrieval of WooCommerce store data.

All tools return a standardized response envelope:

```json
{
  "success": true,
  "data": { ... } | [ ... ],
  "pagination": {
    "page": 1,
    "per_page": 10,
    "total_items": 42,
    "total_pages": 5
  },
  "provider": "woocommerce",
  "request_id": "req_a1b2c3d4e5f6"
}
```

Errors return a standardized error envelope:

```json
{
  "success": false,
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "Order with ID '999' was not found.",
    "retryable": false,
    "request_id": "req_a1b2c3d4e5f6"
  }
}
```

---

## 1. Orders Tools

### `list_orders`
List recent orders from the authenticated merchant's store, ordered newest first.

* **Inputs**:
  * `page` (integer, optional, default: 1): Page number (starts at 1).
  * `per_page` (integer, optional, default: 10, max: 50): Number of orders per page.
  * `status` (enum, optional): One of `any`, `pending`, `processing`, `on-hold`, `completed`, `cancelled`, `refunded`, `failed`.
* **Outputs**: Array of normalized orders and pagination metadata.
* **Example Prompt**: *"Show me the latest 5 completed orders."*

### `get_order`
Retrieve complete details for a single order by its numeric ID.

* **Inputs**:
  * `id` (integer, required): Positive numeric order ID.
* **Outputs**: Normalized order object containing line items, status, total, currency, dates, and masked customer email.
* **Example Prompt**: *"What are the line items in order #501?"*

### `search_orders`
Search orders using targeted criteria.

* **Inputs**:
  * `query` (string, optional, max: 100): Keyword matching order ID, item name, or customer name.
  * `status` (enum, optional): Order status filter.
  * `after` (string, optional): ISO 8601 date string (e.g. `2026-01-01T00:00:00Z`).
  * `before` (string, optional): ISO 8601 date string (e.g. `2026-02-01T00:00:00Z`).
  * `customer_email` (string, optional): Exact customer email (requires authorized scope).
  * `page` (integer, optional, default: 1): Page number.
  * `per_page` (integer, optional, default: 10, max: 50): Results per page.
* **Outputs**: Array of matching normalized orders and pagination metadata.
* **Example Prompt**: *"Search for orders placed between Jan 1 and Jan 15 that are currently on hold."*

---

## 2. Products Tools

### `list_products`
List catalog products from the store.

* **Inputs**:
  * `page` (integer, optional, default: 1): Page number.
  * `per_page` (integer, optional, default: 10, max: 50): Products per page.
  * `status` (enum, optional): One of `any`, `draft`, `pending`, `private`, `publish`.
  * `stock_status` (enum, optional): One of `instock`, `outofstock`, `onbackorder`.
  * `category` (string, optional): Category ID or slug.
* **Outputs**: Array of normalized products with SKU, prices, stock quantities, and sanitized descriptions.
* **Example Prompt**: *"List 10 in-stock products in the apparel category."*

### `get_product`
Retrieve detailed information for a single product by numeric ID.

* **Inputs**:
  * `id` (integer, required): Positive numeric product ID.
* **Outputs**: Normalized product object with full pricing, categories, images, and inventory state.
* **Example Prompt**: *"What is the stock quantity and price of product #101?"*

### `search_products`
Search products using a keyword term and optional filters.

* **Inputs**:
  * `search` (string, required, max: 100): Search term matching product title or SKU.
  * `category` (string, optional): Category ID or slug filter.
  * `stock_status` (enum, optional): One of `instock`, `outofstock`, `onbackorder`.
  * `page` (integer, optional, default: 1): Page number.
  * `per_page` (integer, optional, default: 10, max: 50): Products per page.
* **Outputs**: Array of matching normalized products and pagination metadata.
* **Example Prompt**: *"Find any leather jackets in the catalog."*
