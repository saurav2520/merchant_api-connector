import { enforceScope } from "../../auth/authorization.js";
import { MerchantConnection } from "../../auth/tenant-context.js";
import { ValidationError } from "../../errors/error-handler.js";
import { WooCommerceClient } from "./client.js";
import { normalizeProduct } from "./normalizers.js";
import { NormalizedPagination, NormalizedProduct } from "./types.js";

export interface ListProductsParams {
  page?: number;
  per_page?: number;
  status?: string;
  stock_status?: "instock" | "outofstock" | "onbackorder";
  category?: string;
}

export interface SearchProductsParams {
  search: string;
  category?: string;
  stock_status?: "instock" | "outofstock" | "onbackorder";
  page?: number;
  per_page?: number;
}

export interface ProductsResult {
  products: NormalizedProduct[];
  pagination: NormalizedPagination;
}

export class ProductsProvider {
  private client: WooCommerceClient;
  private connection: MerchantConnection;

  constructor(connection: MerchantConnection) {
    this.connection = connection;
    this.client = new WooCommerceClient(connection);
  }

  public async listProducts(params: ListProductsParams = {}): Promise<ProductsResult> {
    enforceScope(this.connection, "products:read");

    const page = Math.max(1, params.page ?? 1);
    const perPage = Math.min(50, Math.max(1, params.per_page ?? 10));

    const queryParams: Record<string, string | number | undefined> = {
      page,
      per_page: perPage,
    };

    if (params.status && params.status !== "any") {
      queryParams.status = params.status;
    }

    if (params.stock_status) {
      queryParams.stock_status = params.stock_status;
    }

    if (params.category) {
      queryParams.category = params.category;
    }

    const res = await this.client.get<Array<Record<string, unknown>>>("products", queryParams, "list_products");
    const rawItems = Array.isArray(res.data) ? res.data : [];

    const products = rawItems.map((item) => normalizeProduct(item));
    const pagination: NormalizedPagination = res.pagination ?? {
      page,
      per_page: perPage,
      total_items: products.length,
      total_pages: 1,
    };

    return { products, pagination };
  }

  public async getProduct(productId: number): Promise<NormalizedProduct> {
    enforceScope(this.connection, "products:read");

    if (!Number.isInteger(productId) || productId <= 0) {
      throw new ValidationError("Product ID must be a positive integer.");
    }

    const res = await this.client.get<Record<string, unknown>>(`products/${productId}`, {}, "get_product");
    return normalizeProduct(res.data);
  }

  public async searchProducts(params: SearchProductsParams): Promise<ProductsResult> {
    enforceScope(this.connection, "products:read");

    const trimmedSearch = (params.search ?? "").trim();
    if (!trimmedSearch) {
      throw new ValidationError("Parameter 'search' is required and must not be empty.");
    }

    if (trimmedSearch.length > 100) {
      throw new ValidationError("Parameter 'search' length cannot exceed 100 characters.");
    }

    const page = Math.max(1, params.page ?? 1);
    const perPage = Math.min(50, Math.max(1, params.per_page ?? 10));

    const queryParams: Record<string, string | number | undefined> = {
      search: trimmedSearch,
      page,
      per_page: perPage,
    };

    if (params.stock_status) {
      queryParams.stock_status = params.stock_status;
    }

    if (params.category) {
      queryParams.category = params.category;
    }

    const res = await this.client.get<Array<Record<string, unknown>>>("products", queryParams, "search_products");
    const rawItems = Array.isArray(res.data) ? res.data : [];

    const products = rawItems.map((item) => normalizeProduct(item));
    const pagination: NormalizedPagination = res.pagination ?? {
      page,
      per_page: perPage,
      total_items: products.length,
      total_pages: 1,
    };

    return { products, pagination };
  }
}
