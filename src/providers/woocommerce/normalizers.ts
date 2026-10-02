import { sanitizePlainText, maskEmail } from "../../security/redaction.js";
import {
  NormalizedOrder,
  NormalizedOrderLineItem,
  NormalizedProduct,
} from "./types.js";

/**
 * Ensures any monetary amount is represented as a reliable decimal string.
 */
export function toDecimalString(val: unknown): string {
  if (val === null || val === undefined || val === "") {
    return "0.00";
  }
  const num = typeof val === "number" ? val : parseFloat(String(val));
  if (isNaN(num)) {
    return "0.00";
  }
  return num.toFixed(2);
}

/**
 * Normalizes raw WooCommerce product payload.
 */
export function normalizeProduct(raw: Record<string, unknown>): NormalizedProduct {
  const categories = Array.isArray(raw.categories)
    ? raw.categories.map((c: Record<string, unknown>) => ({
        id: Number(c.id) || 0,
        name: String(c.name || ""),
        slug: String(c.slug || ""),
      }))
    : [];

  const images = Array.isArray(raw.images)
    ? raw.images.map((img: Record<string, unknown>) => ({
        id: Number(img.id) || 0,
        src: String(img.src || ""),
        alt: String(img.alt || ""),
      }))
    : [];

  return {
    id: Number(raw.id) || 0,
    name: String(raw.name || ""),
    slug: String(raw.slug || ""),
    permalink: String(raw.permalink || ""),
    sku: String(raw.sku || ""),
    price: toDecimalString(raw.price),
    regular_price: toDecimalString(raw.regular_price),
    sale_price: toDecimalString(raw.sale_price),
    on_sale: Boolean(raw.on_sale),
    stock_status: String(raw.stock_status || "outofstock"),
    stock_quantity: raw.stock_quantity !== null && raw.stock_quantity !== undefined ? Number(raw.stock_quantity) : null,
    manage_stock: Boolean(raw.manage_stock),
    short_description: sanitizePlainText(String(raw.short_description || "")),
    description: sanitizePlainText(String(raw.description || "")),
    categories,
    images,
    date_created: String(raw.date_created || ""),
  };
}

/**
 * Normalizes raw WooCommerce order payload.
 */
export function normalizeOrder(raw: Record<string, unknown>, maskPii: boolean = true): NormalizedOrder {
  const rawBilling = (raw.billing as Record<string, unknown>) || {};
  const rawShipping = (raw.shipping as Record<string, unknown>) || {};

  const billing = {
    city: String(rawBilling.city || ""),
    state: String(rawBilling.state || ""),
    country: String(rawBilling.country || ""),
    postcode: String(rawBilling.postcode || ""),
  };

  const shipping = {
    city: String(rawShipping.city || ""),
    state: String(rawShipping.state || ""),
    country: String(rawShipping.country || ""),
    postcode: String(rawShipping.postcode || ""),
  };

  const rawLineItems = Array.isArray(raw.line_items) ? raw.line_items : [];
  let itemCount = 0;

  const line_items: NormalizedOrderLineItem[] = rawLineItems.map((item: Record<string, unknown>) => {
    const qty = Number(item.quantity) || 1;
    itemCount += qty;
    return {
      id: Number(item.id) || 0,
      name: String(item.name || ""),
      product_id: Number(item.product_id) || 0,
      variation_id: Number(item.variation_id) || 0,
      quantity: qty,
      subtotal: toDecimalString(item.subtotal),
      total: toDecimalString(item.total),
      sku: String(item.sku || ""),
      price: toDecimalString(item.price),
    };
  });

  const rawEmail = typeof rawBilling.email === "string" ? rawBilling.email : null;
  const customerEmail = maskPii ? maskEmail(rawEmail) : rawEmail;

  return {
    id: Number(raw.id) || 0,
    number: String(raw.number || raw.id || ""),
    status: String(raw.status || "pending"),
    currency: String(raw.currency || "USD"),
    date_created: String(raw.date_created || ""),
    date_modified: String(raw.date_modified || ""),
    total: toDecimalString(raw.total),
    discount_total: toDecimalString(raw.discount_total),
    shipping_total: toDecimalString(raw.shipping_total),
    total_tax: toDecimalString(raw.total_tax),
    payment_method_title: String(raw.payment_method_title || ""),
    customer_id: Number(raw.customer_id) || 0,
    customer_email: customerEmail,
    billing,
    shipping,
    line_items,
    item_count: itemCount,
  };
}
