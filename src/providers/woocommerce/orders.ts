import { enforceScope } from "../../auth/authorization.js";
import { MerchantConnection } from "../../auth/tenant-context.js";
import { loadAppConfig } from "../../config/env.js";
import { ValidationError } from "../../errors/error-handler.js";
import { WooCommerceClient } from "./client.js";
import { normalizeOrder } from "./normalizers.js";
import { NormalizedOrder, NormalizedPagination } from "./types.js";

export interface ListOrdersParams {
  page?: number;
  per_page?: number;
  status?: string;
}

export interface SearchOrdersParams {
  query?: string;
  status?: string;
  after?: string;
  before?: string;
  customer_email?: string;
  page?: number;
  per_page?: number;
}

export interface OrdersResult {
  orders: NormalizedOrder[];
  pagination: NormalizedPagination;
}

export class OrdersProvider {
  private client: WooCommerceClient;
  private connection: MerchantConnection;
  private config = loadAppConfig();

  constructor(connection: MerchantConnection) {
    this.connection = connection;
    this.client = new WooCommerceClient(connection);
  }

  public async listOrders(params: ListOrdersParams = {}): Promise<OrdersResult> {
    enforceScope(this.connection, "orders:read");

    const page = Math.max(1, params.page ?? 1);
    const perPage = Math.min(50, Math.max(1, params.per_page ?? 10));

    const queryParams: Record<string, string | number | undefined> = {
      page,
      per_page: perPage,
      orderby: "date",
      order: "desc",
    };

    if (params.status && params.status !== "any") {
      queryParams.status = params.status;
    }

    const res = await this.client.get<Array<Record<string, unknown>>>("orders", queryParams, "list_orders");
    const rawItems = Array.isArray(res.data) ? res.data : [];

    const orders = rawItems.map((item) => normalizeOrder(item, this.config.MASK_CUSTOMER_PII));
    const pagination: NormalizedPagination = res.pagination ?? {
      page,
      per_page: perPage,
      total_items: orders.length,
      total_pages: 1,
    };

    return { orders, pagination };
  }

  public async getOrder(orderId: number): Promise<NormalizedOrder> {
    enforceScope(this.connection, "orders:read");

    if (!Number.isInteger(orderId) || orderId <= 0) {
      throw new ValidationError("Order ID must be a positive integer.");
    }

    const res = await this.client.get<Record<string, unknown>>(`orders/${orderId}`, {}, "get_order");
    return normalizeOrder(res.data, this.config.MASK_CUSTOMER_PII);
  }

  public async searchOrders(params: SearchOrdersParams = {}): Promise<OrdersResult> {
    enforceScope(this.connection, "orders:read");

    const page = Math.max(1, params.page ?? 1);
    const perPage = Math.min(50, Math.max(1, params.per_page ?? 10));

    const queryParams: Record<string, string | number | undefined> = {
      page,
      per_page: perPage,
      orderby: "date",
      order: "desc",
    };

    if (params.query && params.query.trim()) {
      queryParams.search = params.query.trim().slice(0, 100);
    }

    if (params.status && params.status !== "any") {
      queryParams.status = params.status;
    }

    // Validate date filters
    if (params.after) {
      const date = new Date(params.after);
      if (isNaN(date.getTime())) {
        throw new ValidationError("Parameter 'after' must be a valid ISO 8601 date string (e.g. 2026-01-01T00:00:00Z).");
      }
      queryParams.after = date.toISOString();
    }

    if (params.before) {
      const date = new Date(params.before);
      if (isNaN(date.getTime())) {
        throw new ValidationError("Parameter 'before' must be a valid ISO 8601 date string (e.g. 2026-12-31T23:59:59Z).");
      }
      queryParams.before = date.toISOString();
    }

    if (params.after && params.before) {
      const afterMs = new Date(params.after).getTime();
      const beforeMs = new Date(params.before).getTime();
      if (afterMs > beforeMs) {
        throw new ValidationError("Parameter 'after' date must be before 'before' date.");
      }
      // Max 365 days range
      const diffDays = (beforeMs - afterMs) / (1000 * 60 * 60 * 24);
      if (diffDays > 366) {
        throw new ValidationError("Date search range cannot exceed 366 days to protect merchant store performance.");
      }
    }

    // Customer email search - only if authorized or explicitly permitted
    if (params.customer_email && params.customer_email.trim()) {
      const email = params.customer_email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new ValidationError("Parameter 'customer_email' must be a valid email address format.");
      }
      // Enforce customer_pii scope if searching by exact email
      enforceScope(this.connection, "customer_pii:read");
      queryParams.search = email;
    }

    const res = await this.client.get<Array<Record<string, unknown>>>("orders", queryParams, "search_orders");
    const rawItems = Array.isArray(res.data) ? res.data : [];

    const orders = rawItems.map((item) => normalizeOrder(item, this.config.MASK_CUSTOMER_PII));
    const pagination: NormalizedPagination = res.pagination ?? {
      page,
      per_page: perPage,
      total_items: orders.length,
      total_pages: 1,
    };

    return { orders, pagination };
  }
}
