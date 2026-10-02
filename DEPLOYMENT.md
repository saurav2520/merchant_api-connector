# Deployment Guide for Merchant AI Connector

Merchant AI Connector can be deployed locally, via Docker containers, or inside private cloud container runtimes.

---

## 1. Prerequisites

* **Node.js**: Version 18.0.0 or higher.
* **WooCommerce Store**: Running WooCommerce v3+ with REST API enabled.
* **API Credentials**: One consumer key and secret pair created with **Read-only** permissions in:
  `WooCommerce → Settings → Advanced → REST API → Add key`.

---

## 2. Docker Deployment (Recommended for Production)

### 2.1 Build the Docker Image

```bash
docker build -t merchant-ai-connector:latest .
```

The Dockerfile is hardened with:
* Multi-stage build for minimal image size.
* Non-root container user (`USER node`).
* Built-in container health check.
* Secrets injected strictly at runtime via environment variables (never baked into image layers).

### 2.2 Run with Docker

```bash
docker run -i --rm \
  --name merchant-connector \
  -e WP_URL="https://shop.example.com" \
  -e WC_CONSUMER_KEY="ck_your_read_key" \
  -e WC_CONSUMER_SECRET="cs_your_read_secret" \
  -e LOG_LEVEL="INFO" \
  merchant-ai-connector:latest
```

---

## 3. Local Installation & Execution

### 3.1 Install Dependencies & Build

```bash
git clone https://github.com/wppoland/woocommerce-mcp.git merchant-ai-connector
cd merchant-ai-connector
npm ci
npm run build
```

### 3.2 Run the Server

Configure environment variables and start the server:

```bash
# On Linux / macOS
export WP_URL="https://shop.example.com"
export WC_CONSUMER_KEY="ck_your_read_key"
export WC_CONSUMER_SECRET="cs_your_read_secret"
npm start

# On Windows (PowerShell)
$env:WP_URL="https://shop.example.com"
$env:WC_CONSUMER_KEY="ck_your_read_key"
$env:WC_CONSUMER_SECRET="cs_your_read_secret"
npm start
```

---

## 4. Connecting to Agent Studio / MCP Clients

Add the connector to your MCP client configuration (e.g. `claude_desktop_config.json` or Agent Studio configuration):

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

Or using Docker:

```json
{
  "mcpServers": {
    "merchant-ai-connector": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e", "WP_URL=https://shop.example.com",
        "-e", "WC_CONSUMER_KEY=ck_your_read_key",
        "-e", "WC_CONSUMER_SECRET=cs_your_read_secret",
        "merchant-ai-connector:latest"
      ]
    }
  }
}
```

---

## 5. Graceful Shutdown & Health Checks

* **Signal Handling**: The server listens for `SIGINT` and `SIGTERM` signals, closes the MCP server cleanly, and exits with code 0.
* **Stdio Protocol Protection**: All logs, diagnostic messages, and error traces are piped exclusively to `stderr`, guaranteeing that `stdout` remains pristine for MCP JSON-RPC messaging.
