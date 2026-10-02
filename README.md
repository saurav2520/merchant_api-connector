<img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/b1f88a99-b14a-4c4f-9201-5dafae2d9b4e" />

# Merchant AI Connector

A secure, private, strictly read-only [Model Context Protocol (MCP)](https://modelcontextprotocol.io) connector for **WooCommerce stores**, engineered for integration with **Agent Studio** and compatible MCP clients (Claude Desktop, Cursor, Agent SDKs).

The connector allows authorized AI agents to inspect product catalogs and retrieve order details using merchant-generated, read-only WooCommerce REST API credentials.

> **Origin & Attribution**: Built upon the open-source foundation of `woocommerce-mcp` by [WPPoland](https://wppoland.com/en/). Re-architected with enterprise security, tenant isolation, SSRF defenses, circuit breaking, bounded retries, and comprehensive input validation. Licensed under the MIT License.

---

## 1. Product Overview

Merchant AI Connector provides an isolated bridge between agentic AI workflows and a merchant's WooCommerce installation. It strictly exposes **read-only retrieval** tools, preventing any accidental or unauthorized state changes (such as order cancellations, price alterations, or inventory adjustments).

```
┌──────────────────────────┐
│   Agent Studio / Client  │
│  (Claude, Cursor, etc.)  │
└─────────────┬────────────┘
              │ JSON-RPC (stdio transport)
              ▼
┌───────────────────────────────────────────────────────────────┐
│                    Merchant AI Connector                      │
│                                                               │
│   ┌────────────────────┐          ┌───────────────────────┐   │
│   │ Input Validation   │          │ Scope Authorization   │   │
│   │ (Zod Strict)       │          │ (Strict Read-Only)    │   │
│   └─────────┬──────────┘          └───────────┬───────────┘   │
│             │                                 │               │
│             ▼                                 ▼               │
│   ┌────────────────────┐          ┌───────────────────────┐   │
│   │ SSRF / IP Guard    │          │ Token Bucket Limiter  │   │
│   │ (Private IP Block) │          │ & Circuit Breaker     │   │
│   └─────────┬──────────┘          └───────────┬───────────┘   │
│             │                                 │               │
│             ▼                                 ▼               │
│   ┌────────────────────┐          ┌───────────────────────┐   │
│   │ Response           │          │ Exponential Backoff   │   │
│   │ Normalization      │          │ with Jitter           │   │
│   └────────────────────┘          └───────────────────────┘   │
└──────────────────────────────┬────────────────────────────────┘
                               │ HTTPS Basic Auth (GET only)
                               ▼
              ┌─────────────────────────────────┐
              │    WooCommerce Store REST API   │
              │  (/wp-json/wc/v3/{orders|...})  │
              └─────────────────────────────────┘
```

---

## 2. Key Features

* **Strictly Read-Only**: Enforces GET-only requests to official WooCommerce REST API v3 endpoints. Zero write tools exposed.
* **SSRF Defenses**: Prohibits private networks (RFC1918), loopback (`127.0.0.1`), link-local metadata (`169.254.169.254`), and carrier-grade NAT. Enforces HTTPS in production.
* **Credential Redaction**: Redacts `ck_*` and `cs_*` tokens from error responses and logs automatically.
* **Tenant Isolation**: Execution context binds requests securely to merchant configurations. The AI agent cannot supply or alter tenant IDs or credentials.
* **Resilience & Fault Tolerance**:
  * In-memory token bucket rate limiting per merchant connection.
  * Circuit breaker trips on repeated store failures (cooldown 30s).
  * Exponential backoff retries with 30% jitter for transient upstream errors (429, 502, 503, 504).
  * Respects `Retry-After` headers.
  * Configurable request deadlines and timeouts.
* **Privacy & Content Sanitization**: Masks customer emails by default, minimizes billing address data, and disarms HTML from product descriptions.
* **Standardized JSON Envelopes**: Predictable output shapes containing `success`, `data`, `pagination`, `provider`, and `request_id`.
* **Zero stdout Pollution**: Stdio transport protocol remains intact by routing all structured logging to `stderr`.

---

## 3. Required Tools

| Tool | Category | Description | Permissions |
|---|---|---|:---:|
| `list_orders` | Orders | List recent orders with pagination (max 50) and status filters. | Read-only |
| `get_order` | Orders | Retrieve complete details of an order by numeric ID. | Read-only |
| `search_orders` | Orders | Search orders by query, status, date range (max 366 days), or email. | Read-only |
| `list_products` | Products | List catalog products with pagination, category, and stock filters. | Read-only |
| `get_product` | Products | Retrieve product pricing, SKU, and stock details by numeric ID. | Read-only |
| `search_products` | Products | Search products by keyword with optional stock/category filters. | Read-only |

For full parameter specifications and response structures, see [API_TOOLS.md](API_TOOLS.md).

---

## 4. Prerequisites

1. **Node.js**: Version 18.0.0 or higher.
2. **WooCommerce Store**: A WordPress installation running WooCommerce with HTTPS enabled.
3. **WooCommerce API Keys**: Read-only credentials generated from the WooCommerce dashboard.

---

## 5. Merchant API Credential Setup

1. Log into your WordPress / WooCommerce Administration Dashboard.
2. Navigate to **WooCommerce → Settings → Advanced → REST API**.
3. Click **Add key**.
4. Set the **Description** to: `Merchant AI Connector (Agent Studio)`.
5. Set **Permissions** to **Read**. (Do **NOT** select *Read/Write* or *Write*).
6. Click **Generate API key**.
7. Copy the **Consumer Key** (`ck_...`) and **Consumer Secret** (`cs_...`).

---

## 6. Setup and Installation

### Option A: Local Installation from Source

```bash
# Clone the repository
git clone https://github.com/wppoland/woocommerce-mcp.git merchant-ai-connector
cd merchant-ai-connector

# Install dependencies
npm ci

# Compile TypeScript
npm run build

# Run verification tests
npm test
```

### Option B: Docker Container

```bash
# Build the production image
docker build -t merchant-ai-connector:latest .
```

---

## 7. Environment Configuration

Create a `.env` file in the root directory (refer to `.env.example`):

```bash
cp .env.example .env
```

Configure the following variables:

| Variable | Required | Default | Description |
|---|:---:|:---:|---|
| `WP_URL` | **Yes** | - | Merchant store base URL (e.g. `https://shop.example.com`). Must be HTTPS in production. |
| `WC_CONSUMER_KEY` | **Yes** | - | WooCommerce REST API consumer key (`ck_...`). |
| `WC_CONSUMER_SECRET` | **Yes** | - | WooCommerce REST API consumer secret (`cs_...`). |
| `ALLOW_INSECURE_HTTP` | No | `false` | Set `true` **only** for local mock/dev testing. Disables HTTPS requirement and private IP blocks. |
| `REQUEST_TIMEOUT_MS` | No | `10000` | Request timeout per upstream call in milliseconds. |
| `MAX_RETRIES` | No | `2` | Number of retries for transient upstream failures. |
| `RATE_LIMIT_RPS` | No | `10` | Requests per second token refill rate. |
| `RATE_LIMIT_BURST` | No | `20` | Maximum burst capacity per tenant. |
| `MASK_CUSTOMER_PII` | No | `true` | Masks customer email addresses in responses. |
| `LOG_LEVEL` | No | `INFO` | Logging level (`DEBUG`, `INFO`, `WARN`, `ERROR`). |

---

## 8. How to Run

### Direct Command Line

```bash
# Set environment variables
export WP_URL="https://shop.example.com"
export WC_CONSUMER_KEY="ck_your_read_key"
export WC_CONSUMER_SECRET="cs_your_read_secret"

# Start the connector
npm start
```

### With Docker

```bash
docker run -i --rm \
  -e WP_URL="https://shop.example.com" \
  -e WC_CONSUMER_KEY="ck_your_read_key" \
  -e WC_CONSUMER_SECRET="cs_your_read_secret" \
  merchant-ai-connector:latest
```

---

## 9. Connecting to MCP Clients and Agent Studio

### Claude Desktop Configuration
Add the server configuration to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "merchant-ai-connector": {
      "command": "node",
      "args": ["/absolute/path/to/merchant-ai-connector/dist/index.js"],
      "env": {
        "WP_URL": "https://shop.example.com",
        "WC_CONSUMER_KEY": "ck_your_read_key",
        "WC_CONSUMER_SECRET": "cs_your_read_secret",
        "ALLOW_INSECURE_HTTP": "false",
        "LOG_LEVEL": "INFO"
      }
    }
  }
}
```

### Agent Studio Configuration
When registering the connector in Agent Studio:
1. Select **Stdio Transport**.
2. Point the command to `node dist/index.js` or the Docker container.
3. Configure the store credentials in the private environment variables panel.

---

## 10. Example Agent Inquiries

Once connected, you can ask the agent:

* *"What were our 5 most recent processing orders?"*
* *"Is the 'Classic Leather Jacket' currently in stock and what is its price?"*
* *"Search for any orders placed between February 1st and February 15th."*
* *"Retrieve full details for order #501."*
* *"List all out-of-stock items in our catalog."*

---

## 11. Security Limitations & Operational Boundaries

* **Read-Only by Design**: The connector will refuse any instruction to cancel an order, modify product pricing, or refund a purchase.
* **Page Bounds**: Results are capped at 50 items per page to prevent memory exhaustion and store database degradation.
* **Date Range Limits**: Date searches are bounded to a maximum window of 366 days.
* **Point-in-Time Consistency**: Catalog and order data reflects the state at the time of API retrieval.

For complete security specifications, refer to [SECURITY.md](SECURITY.md).
For agent behavior rules, refer to [AGENT_CAPABILITIES.md](AGENT_CAPABILITIES.md).

---

## 12. Troubleshooting

| Symptom | Cause | Solution |
|---|---|---|
| `AUTHENTICATION_FAILED` (401) | Consumer key or secret is invalid or expired. | Re-generate read-only credentials in WooCommerce settings. |
| `ACCESS_FORBIDDEN` (403) | API key does not have Read permissions or HTTPS is missing. | Verify key permissions are set to **Read** in WooCommerce. |
| `HTTPS_REQUIRED` | `WP_URL` begins with `http://`. | Merchant stores must use HTTPS. (For local testing only, set `ALLOW_INSECURE_HTTP=true`). |
| `SSRF_PRIVATE_IP` | `WP_URL` points to localhost or private IP range. | Use the public merchant store domain or enable `ALLOW_INSECURE_HTTP=true` in testing. |
| `CIRCUIT_BREAKER_OPEN` | Store returned 5 consecutive upstream errors. | Wait 30 seconds for cooldown and check WooCommerce store health. |
| `RATE_LIMIT_EXCEEDED` | Requests exceeded RPS or burst threshold. | The client will receive a `retry_after` duration. Reduce agent concurrency. |

---

## 13. Testing and Verification

Run the automated test suite:

```bash
npm test
```

All 13 test suites (unit, integration, security, resilience, MCP protocol) execute automatically with mock fixtures.

---

## 14. License and Attribution

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.

Original open-source foundation developed by **[WPPoland](https://wppoland.com/en/)**.
Rebranded, enhanced, and maintained for **Agent Studio** as **Merchant AI Connector**.
