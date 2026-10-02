import { AuthorizationError } from "../errors/error-handler.js";
import { MerchantConnection } from "./tenant-context.js";

export type RequiredScope = "orders:read" | "products:read" | "customer_pii:read";

export function enforceScope(connection: MerchantConnection, requiredScope: RequiredScope): void {
  // Strict read-only enforcement: any write scope is rejected at the architecture level
  if (
    requiredScope.includes("write") ||
    requiredScope.includes("delete") ||
    requiredScope.includes("update") ||
    requiredScope.includes("create")
  ) {
    throw new AuthorizationError("Write operations are strictly forbidden in Merchant AI Connector.");
  }

  if (!connection.authorizedScopes.includes(requiredScope) && !connection.authorizedScopes.includes("*")) {
    throw new AuthorizationError(
      `Permission denied. Active merchant connection lacks required scope: '${requiredScope}'.`,
    );
  }
}
