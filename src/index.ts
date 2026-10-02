#!/usr/bin/env node
/**
 * Merchant AI Connector
 * Secure, private, read-only MCP connector for WooCommerce store data in Agent Studio.
 *
 * Provides AI agents read access to merchant products and orders over the WooCommerce REST API v3.
 * Strictly read-only by design.
 *
 * Configuration:
 *   WP_URL              Base URL of merchant store (HTTPS required)
 *   WC_CONSUMER_KEY     WooCommerce REST API key (Read permission)
 *   WC_CONSUMER_SECRET  WooCommerce REST API secret (Read permission)
 *
 * Licensed under MIT. Original foundation based on woocommerce-mcp by WPPoland.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { pathToFileURL } from "node:url";
import { createServer, SERVER_NAME, VERSION } from "./server/mcp-server.js";
import { logger } from "./observability/logger.js";

export { createServer, SERVER_NAME, VERSION };

export async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  // Setup graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down Merchant AI Connector gracefully...`);
    try {
      await server.close();
    } catch {
      /* ignore close errors during termination */
    }
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  await server.connect(transport);

  // Stdio transport: logs MUST go to stderr so they don't corrupt JSON-RPC on stdout.
  console.error(`Merchant AI Connector v${VERSION} ready (stdio)`);
}

// Windows-compatible entrypoint execution check
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((err) => {
    console.error(`Fatal startup error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
