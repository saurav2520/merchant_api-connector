import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./tool-registry.js";

export const VERSION = "0.1.1";
export const SERVER_NAME = "merchant-ai-connector";

export function createServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: VERSION,
  });

  registerAllTools(server);
  return server;
}
