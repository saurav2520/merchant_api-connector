import { AsyncLocalStorage } from "node:async_hooks";
import { AuthenticationError } from "../errors/error-handler.js";
import { loadAppConfig } from "../config/env.js";

export interface MerchantConnection {
  tenantId: string;
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
  authorizedScopes: string[];
  allowInsecureHttp?: boolean;
}

export class TenantConnectionRegistry {
  private connections = new Map<string, MerchantConnection>();

  public register(connection: MerchantConnection): void {
    if (!connection.tenantId || !connection.storeUrl || !connection.consumerKey || !connection.consumerSecret) {
      throw new Error("Invalid merchant connection configuration. All credentials and storeUrl are required.");
    }
    this.connections.set(connection.tenantId, { ...connection });
  }

  public get(tenantId: string): MerchantConnection | undefined {
    return this.connections.get(tenantId);
  }

  public has(tenantId: string): boolean {
    return this.connections.has(tenantId);
  }

  public unregister(tenantId: string): boolean {
    return this.connections.delete(tenantId);
  }

  public clear(): void {
    this.connections.clear();
  }
}

export const tenantRegistry = new TenantConnectionRegistry();

// AsyncLocalStorage to maintain tenant context across asynchronous tool calls securely
const asyncLocalStorage = new AsyncLocalStorage<MerchantConnection>();

export class TenantContextManager {
  /**
   * Run a function within the context of a specific merchant connection.
   */
  public static runWithConnection<R>(connection: MerchantConnection, fn: () => R): R {
    return asyncLocalStorage.run(connection, fn);
  }

  /**
   * Resolves the current active merchant connection.
   * If in an async context, returns that context's connection.
   * Otherwise falls back to the default single-merchant local configuration from environment variables.
   */
  public static getActiveConnection(): MerchantConnection {
    const current = asyncLocalStorage.getStore();
    if (current) {
      return current;
    }

    // Fall back to local single-store environment configuration
    const config = loadAppConfig();
    const wpUrl = (config.WP_URL ?? "").trim().replace(/\/+$/, "");
    const key = (config.WC_CONSUMER_KEY ?? "").trim();
    const secret = (config.WC_CONSUMER_SECRET ?? "").trim();

    if (!wpUrl) {
      throw new AuthenticationError("Missing required environment variable WP_URL (e.g. https://shop.example.com).");
    }

    if (!key || !secret) {
      throw new AuthenticationError(
        "Merchant AI Connector requires WC_CONSUMER_KEY and WC_CONSUMER_SECRET with read permissions.",
      );
    }

    return {
      tenantId: "local-default",
      storeUrl: wpUrl,
      consumerKey: key,
      consumerSecret: secret,
      authorizedScopes: ["orders:read", "products:read"],
      allowInsecureHttp: config.ALLOW_INSECURE_HTTP,
    };
  }
}
