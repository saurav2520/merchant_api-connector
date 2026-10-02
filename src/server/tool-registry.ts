import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerOrderTools } from "../tools/orders.js";
import { registerProductTools } from "../tools/products.js";

export function registerAllTools(server: McpServer): void {
  registerOrderTools(server);
  registerProductTools(server);
}
