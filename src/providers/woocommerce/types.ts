/**
 * Types and interfaces for WooCommerce REST API v3 models and normalized outputs.
 */

export interface NormalizedPagination {
  page: number;
  per_page: number;
  total_items?: number;
  total_pages?: number;
}

export interface NormalizedProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  sku: string;
  price: string; // decimal string, e.g. "19.99"
  regular_price: string;
  sale_price: string;
  on_sale: boolean;
  stock_status: "instock" | "outofstock" | "onbackorder" | string;
  stock_quantity: number | null;
  manage_stock: boolean;
  short_description: string;
  description: string; // sanitized plaintext
  categories: Array<{ id: number; name: string; slug: string }>;
  images: Array<{ id: number; src: string; alt: string }>;
  date_created: string;
}

export interface NormalizedOrderLineItem {
  id: number;
  name: string;
  product_id: number;
  variation_id: number;
  quantity: number;
  subtotal: string;
  total: string;
  sku: string;
  price: string;
}

export interface NormalizedOrder {
  id: number;
  number: string;
  status: string;
  currency: string;
  date_created: string;
  date_modified: string;
  total: string; // decimal string
  discount_total: string;
  shipping_total: string;
  total_tax: string;
  payment_method_title: string;
  customer_id: number;
  customer_email: string | null;
  billing: {
    city: string;
    state: string;
    country: string;
    postcode: string;
  };
  shipping: {
    city: string;
    state: string;
    country: string;
    postcode: string;
  };
  line_items: NormalizedOrderLineItem[];
  item_count: number;
}
