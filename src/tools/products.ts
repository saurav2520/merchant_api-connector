import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TenantContextManager } from "../auth/tenant-context.js";
import { ProductsProvider } from "../providers/woocommerce/products.js";
import { executeToolSafe } from "./envelope.js";

export function registerProductTools(server: McpServer): void {
  server.registerTool(
    "list_products",
    {
      title: "List Products",
      description:
        "List products from the merchant store with pagination, status, and stock filtering. Read-only.",
      inputSchema: {
        page: z.number().int().min(1).optional().describe("Page number (starts at 1, default 1)"),
        per_page: z.number().int().min(1).max(50).optional().describe("Products per page (1-50, default 10)"),
        status: z.enum(["any", "draft", "pending", "private", "publish"]).optional().describe("Product publication status"),
        stock_status: z.enum(["instock", "outofstock", "onbackorder"]).optional().describe("Filter by stock status"),
        category: z.string().optional().describe("Filter by product category ID or slug"),
      },
    },
    async (args) => {
      return executeToolSafe("list_products", async () => {
        const connection = TenantContextManager.getActiveConnection();
        const provider = new ProductsProvider(connection);
        const result = await provider.listProducts({
          page: args.page,
          per_page: args.per_page,
          status: args.status,
          stock_status: args.stock_status,
          category: args.category,
        });
        return { data: result.products, pagination: result.pagination };
      });
    },
  );

  server.registerTool(
    "get_product",
    {
      title: "Get Product",
      description:
        "Retrieve detailed information for a single product by numeric ID including SKU, price, and stock. Read-only.",
      inputSchema: {
        id: z.number().int().positive().describe("Numeric product ID to retrieve"),
      },
    },
    async (args) => {
      return executeToolSafe("get_product", async () => {
        const connection = TenantContextManager.getActiveConnection();
        const provider = new ProductsProvider(connection);
        const product = await provider.getProduct(args.id);
        return { data: product };
      });
    },
  );

  server.registerTool(
    "search_products",
    {
      title: "Search Products",
      description:
        "Search products by a keyword term with optional category and stock status filtering and pagination. Read-only.",
      inputSchema: {
        search: z.string().min(1).max(100).describe("Keyword search term matching product title or SKU"),
        category: z.string().optional().describe("Filter by category ID or slug"),
        stock_status: z.enum(["instock", "outofstock", "onbackorder"]).optional().describe("Filter by stock status"),
        page: z.number().int().min(1).optional().describe("Page number (starts at 1, default 1)"),
        per_page: z.number().int().min(1).max(50).optional().describe("Products per page (1-50, default 10)"),
      },
    },
    async (args) => {
      return executeToolSafe("search_products", async () => {
        const connection = TenantContextManager.getActiveConnection();
        const provider = new ProductsProvider(connection);
        const result = await provider.searchProducts({
          search: args.search,
          category: args.category,
          stock_status: args.stock_status,
          page: args.page,
          per_page: args.per_page,
        });
        return { data: result.products, pagination: result.pagination };
      });
    },
  );
}
