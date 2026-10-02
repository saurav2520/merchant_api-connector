import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TenantContextManager } from "../auth/tenant-context.js";
import { OrdersProvider } from "../providers/woocommerce/orders.js";
import { executeToolSafe } from "./envelope.js";

export function registerOrderTools(server: McpServer): void {
  server.registerTool(
    "list_orders",
    {
      title: "List Orders",
      description:
        "List recent orders from the merchant store with pagination and status filtering. Read-only.",
      inputSchema: {
        page: z.number().int().min(1).optional().describe("Page number (starts at 1, default 1)"),
        per_page: z.number().int().min(1).max(50).optional().describe("Orders per page (1-50, default 10)"),
        status: z
          .enum(["any", "pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed"])
          .optional()
          .describe("Filter orders by lifecycle status"),
      },
    },
    async (args) => {
      return executeToolSafe("list_orders", async () => {
        const connection = TenantContextManager.getActiveConnection();
        const provider = new OrdersProvider(connection);
        const result = await provider.listOrders({
          page: args.page,
          per_page: args.per_page,
          status: args.status,
        });
        return { data: result.orders, pagination: result.pagination };
      });
    },
  );

  server.registerTool(
    "get_order",
    {
      title: "Get Order",
      description:
        "Retrieve details for a single WooCommerce order by its numeric ID. Read-only.",
      inputSchema: {
        id: z.number().int().positive().describe("Numeric order ID to retrieve"),
      },
    },
    async (args) => {
      return executeToolSafe("get_order", async () => {
        const connection = TenantContextManager.getActiveConnection();
        const provider = new OrdersProvider(connection);
        const order = await provider.getOrder(args.id);
        return { data: order };
      });
    },
  );

  server.registerTool(
    "search_orders",
    {
      title: "Search Orders",
      description:
        "Search orders by keyword query, status, date ranges (after/before), or customer email with pagination. Read-only.",
      inputSchema: {
        query: z.string().max(100).optional().describe("Keyword search matching order ID, item name, or customer name"),
        status: z
          .enum(["any", "pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed"])
          .optional()
          .describe("Filter by order status"),
        after: z
          .string()
          .optional()
          .describe("Filter orders created on or after ISO 8601 date (e.g. 2026-01-01T00:00:00Z)"),
        before: z
          .string()
          .optional()
          .describe("Filter orders created on or before ISO 8601 date (e.g. 2026-12-31T23:59:59Z)"),
        customer_email: z.string().email().optional().describe("Filter orders by customer email (requires authorized scope)"),
        page: z.number().int().min(1).optional().describe("Page number (starts at 1, default 1)"),
        per_page: z.number().int().min(1).max(50).optional().describe("Orders per page (1-50, default 10)"),
      },
    },
    async (args) => {
      return executeToolSafe("search_orders", async () => {
        const connection = TenantContextManager.getActiveConnection();
        const provider = new OrdersProvider(connection);
        const result = await provider.searchOrders({
          query: args.query,
          status: args.status,
          after: args.after,
          before: args.before,
          customer_email: args.customer_email,
          page: args.page,
          per_page: args.per_page,
        });
        return { data: result.orders, pagination: result.pagination };
      });
    },
  );
}
