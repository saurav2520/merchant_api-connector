# Testing and Verification Guide

Merchant AI Connector includes a comprehensive test suite covering unit functionality, mock store integration, security defenses, fault resilience, and MCP protocol handshakes.

---

## 1. Running the Test Suite

Execute the entire test suite with a single command:

```bash
npm test
```

Or run the full build and verification check:

```bash
npm run check
```

---

## 2. Test Suite Breakdown

The test suite runs 13 distinct verification suites:

| Test Suite | File | What It Verifies |
|---|---|---|
| **URL Validation & SSRF** | `test/unit/url-validation.test.mjs` | Prohibits private IP addresses, loopback, AWS metadata (169.254.169.254), carrier NAT, embedded credentials, and insecure HTTP in production. |
| **Normalizers** | `test/unit/normalizers.test.mjs` | Converts prices and subtotals to decimal strings, strips HTML/scripts, masks customer emails, and extracts item quantities safely. |
| **Rate Limiter** | `test/unit/rate-limiter.test.mjs` | Verifies token bucket exhaustion, `retryAfterMs` calculations, tenant quota isolation, and tool-specific limits. |
| **Circuit Breaker** | `test/unit/circuit-breaker.test.mjs` | Verifies transition from CLOSED to OPEN on consecutive failures, half-open probing, and per-host isolation. |
| **Bounded Retry** | `test/unit/retry.test.mjs` | Verifies exponential backoff with jitter, Retry-After header parsing, and strict prohibition on retrying 400/401/403/404 errors. |
| **Auth & Scopes** | `test/unit/auth.test.mjs` | Verifies tenant connection registry, AsyncLocalStorage context switching, and unconditional rejection of write scopes. |
| **Secret Redaction** | `test/unit/redaction.test.mjs` | Verifies automatic redaction of `ck_*` and `cs_*` tokens from error strings and JSON log entries. |
| **Mock Store Integration** | `test/integration/tools.test.mjs` | Spins up a lightweight mock WooCommerce REST API v3 server and tests all 6 tools for correct retrieval and pagination. |
| **Security & Vulnerabilities** | `test/security/security.test.mjs` | Tests invalid credential mapping, 403 forbidden responses, input validation boundaries (negative IDs, invalid dates), and secret leakage prevention. |
| **Resilience & Faults** | `test/resilience/resilience.test.mjs` | Tests upstream 429 rate limit responses, 503 service unavailable retries, malformed JSON handling, and circuit breaker trip enforcement. |
| **MCP Protocol Handshake** | `test/mcp/mcp-protocol.test.mjs` | Connects to the McpServer instance, confirms all 6 tools are discoverable, and executes a tool via the MCP registry. |
| **Smoke Check** | `test/smoke.mjs` | Confirms server registration and semantic version alignment with package.json. |
| **CLI Entrypoint** | `test/entrypoint.mjs` | Spawns the compiled `dist/index.js` over stdio and executes the full MCP `initialize` handshake as an external client. |

---

## 3. Testing Against a Live WooCommerce Store

To run against a live WooCommerce store:

1. Create a `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```
2. Populate `WP_URL`, `WC_CONSUMER_KEY`, and `WC_CONSUMER_SECRET` with live **Read-only** credentials.
3. Start the server and run your MCP client to verify tool responses against live store inventory.
