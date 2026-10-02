# Agent Capabilities and Operational Limitations

This document specifies the exact operational boundaries, capabilities, and safety limitations for AI agents interacting with the **Merchant AI Connector**.

---

## 1. What the Agent CAN Do

When authorized and connected to a merchant's WooCommerce store, the AI agent can:

* **List Orders**: Retrieve recent orders with pagination (up to 50 per page) and status filters (`pending`, `processing`, `on-hold`, `completed`, `cancelled`, `refunded`, `failed`, `any`).
* **Retrieve Order Details**: Lookup single orders by numeric ID, inspecting line items, quantities, pricing totals, order status, and billing/shipping cities.
* **Search Orders**: Search orders by keyword query, status, date intervals (`after` and `before` within a 366-day window), or customer email (when authorized).
* **List Products**: Browse catalog products with pagination, filtering by stock status (`instock`, `outofstock`, `onbackorder`), status (`publish`, `draft`, etc.), or category.
* **Retrieve Product Details**: Inspect complete product information including SKU, normalized price (decimal string), regular price, sale status, stock quantity, and sanitized descriptions.
* **Search Products**: Find products by keyword query matching name or SKU with category and stock status filters.
* **Synthesize and Summarize**: Analyze sales patterns, check stock availability, and answer customer support inquiries based on retrieved data.

---

## 2. What the Agent CANNOT Do

The connector enforces strict **read-only** constraints at both the MCP schema layer and the backend authorization guard. The agent CANNOT:

* **Modify Orders**: Cannot create, update, cancel, delete, or refund orders.
* **Alter Inventory**: Cannot adjust stock quantities, change product prices, or update catalog descriptions.
* **Process Transactions**: Cannot capture payments, process refunds, charge cards, or manage payment gateway settings.
* **Execute Arbitrary Endpoints**: Cannot invoke arbitrary WordPress REST endpoints, query arbitrary database tables, or execute shell commands.
* **Cross Tenant Boundaries**: Cannot supply or manipulate tenant identifiers, merchant URLs, or credentials. All tool invocations are strictly bound to the authenticated merchant session.
* **Bypass Scopes**: Cannot access customer PII unless granted the specific authorization scope.
* **Guarantee Real-Time State Beyond API Response**: Cannot guarantee live inventory levels beyond the point-in-time timestamp returned in the API response.

---

## 3. Data Privacy and PII Protection

* **Customer Email Masking**: Customer emails are masked by default (e.g. `j*****e@example.com`) to prevent accidental PII exposure to LLM contexts.
* **Minimal Billing Data**: Detailed street addresses, phone numbers, and full names are excluded from the normalized order output unless explicitly authorized.
* **Content Sanitization**: Merchant-supplied HTML descriptions and notes are disarmed and converted to plain text to mitigate prompt injection risks.

---

## 4. Operational Boundaries and Limits

* **Maximum Page Size**: All listing and search endpoints enforce a maximum of 50 items per page (default is 10).
* **Date Range Bounds**: Order date searches (`after` to `before`) are capped at a maximum of 366 days to prevent database strain on the merchant store.
* **Rate Limits**: Requests are bounded by token bucket rate limiters (default: 10 RPS, burst: 20; search operations: 3-5 RPS).
* **Timeouts & Circuit Breakers**: Upstream requests timeout after 10 seconds. Consecutive merchant store failures trip a circuit breaker for 30 seconds.

---

## 5. Agent Behavioral Directive

> **Important**: The AI agent **must never claim or imply** to have performed an action that modified store state (such as cancelling an order, changing a price, or updating inventory). If a user requests a write operation, the agent must inform the user that the connection is strictly read-only and direct them to the WooCommerce Merchant Administration dashboard.
