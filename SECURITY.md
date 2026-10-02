# Security Architecture and Policy

Security is a foundational pillar of **Merchant AI Connector**. This document outlines the security controls implemented to protect merchant stores, credentials, and customer data.

---

## 1. Network & SSRF Defenses

* **HTTPS Enforcement**: In production (`ALLOW_INSECURE_HTTP=false`), all merchant store connections must use TLS (`https://`). Insecure `http://` connections are strictly rejected.
* **Prohibited IP Addresses**: The connector validates store URLs and prohibits loopback (`127.0.0.0/8`, `::1`), private RFC1918 networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), Carrier-grade NAT (`100.64.0.0/10`), link-local/cloud metadata addresses (`169.254.0.0/16`, `fe80::/10`), and multicast addresses.
* **DNS Resolution Validation**: In production environments, hostnames are resolved via DNS prior to connection to protect against DNS rebinding attacks.
* **Prohibited Embedded Credentials**: Store URLs containing embedded user info (e.g. `https://user:pass@host`) are rejected immediately.
* **Disabled Automatic Redirects**: The HTTP client executes with `redirect: "manual"` to prevent SSRF through blind HTTP 30x redirects to internal services.

---

## 2. Authentication & Credential Isolation

* **Read-Only API Keys**: Merchant connections require read-only WooCommerce REST API keys (`ck_...` and `cs_...`). Write-capable keys are never required or recommended.
* **HTTP Basic Authorization Header**: Credentials are transmitted via HTTP Basic Auth headers over TLS rather than URL query parameters, preventing credentials from being recorded in intermediate proxy access logs.
* **Strict Backend Isolation**: API credentials reside exclusively within backend process memory. Credentials are never sent to the LLM, never returned in tool responses, and never logged.
* **Automatic Secret Redaction**: All log messages and error handlers pass through recursive redaction filters that detect and replace API keys, tokens, and authorization headers with `[REDACTED]`.

---

## 3. Strict Read-Only Access & Authorization

* **Strict GET-Only REST Requests**: The connector only issues HTTP `GET` requests to documented WooCommerce REST API v3 endpoints.
* **Architecture-Level Write Prohibition**: All write scopes (`orders:write`, `products:write`, etc.) are unconditionally rejected at the authorization layer.
* **No Arbitrary Proxy Tools**: The server does not expose generic REST proxy tools. Agents cannot pass arbitrary paths, headers, or query parameters.

---

## 4. Tenant Isolation

* **Context-Bound Execution**: Merchant credentials and connections are resolved through trusted server-side context (`TenantContextManager`).
* **No Agent-Supplied Tenant IDs**: Tool schemas strictly forbid the agent from specifying or overriding tenant identifiers, merchant URLs, or credentials.
* **Isolated Rate Limits and Circuit Breakers**: Rate limit buckets and circuit breaker states are partitioned per tenant or merchant origin.

---

## 5. Privacy & Content Sanitization

* **Customer Email Masking**: Customer emails in order records are masked (e.g. `j*****e@example.com`) by default.
* **Minimal Billing and Shipping Data**: Physical street addresses, phone numbers, and full names are excluded from tool responses to adhere to data minimization principles.
* **HTML Stripping**: Merchant catalog descriptions and order notes are sanitized and stripped of HTML and script tags to disarm potential prompt injection vectors.

---

## 6. Resilience & Abuse Prevention

* **Bounded Page Sizes**: Page limits are capped at a maximum of 50 items.
* **Bounded Date Ranges**: Order searches enforce a maximum range of 366 days between `after` and `before`.
* **Execution Deadlines**: Every upstream request enforces a 10-second timeout with an overall execution deadline to prevent retry storms.
* **Circuit Breaking**: If a merchant store experiences 5 consecutive failures, the connector temporarily halts requests to that host for 30 seconds to allow the upstream store to recover.
