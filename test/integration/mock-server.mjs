import * as http from "node:http";

export const SAMPLE_PRODUCTS = [
  {
    id: 101,
    name: "Classic Leather Jacket",
    slug: "classic-leather-jacket",
    permalink: "https://mockstore.local/product/classic-leather-jacket",
    sku: "JKT-001",
    price: "199.99",
    regular_price: "249.99",
    sale_price: "199.99",
    on_sale: true,
    stock_status: "instock",
    stock_quantity: 15,
    manage_stock: true,
    short_description: "Durable genuine leather jacket.",
    description: "<p>Crafted from full-grain leather with brass zippers.</p>",
    categories: [{ id: 1, name: "Outerwear", slug: "outerwear" }],
    images: [{ id: 10, src: "https://mockstore.local/jacket.jpg", alt: "Jacket" }],
    date_created: "2026-01-05T12:00:00",
  },
  {
    id: 102,
    name: "Cotton Crewneck T-Shirt",
    slug: "cotton-crewneck-tshirt",
    permalink: "https://mockstore.local/product/cotton-crewneck-tshirt",
    sku: "TSH-002",
    price: "29.50",
    regular_price: "29.50",
    sale_price: "",
    on_sale: false,
    stock_status: "instock",
    stock_quantity: 80,
    manage_stock: true,
    short_description: "Comfortable daily wear.",
    description: "<p>100% organic cotton, breathable fabric.</p>",
    categories: [{ id: 2, name: "Apparel", slug: "apparel" }],
    images: [{ id: 11, src: "https://mockstore.local/tshirt.jpg", alt: "T-Shirt" }],
    date_created: "2026-01-08T09:30:00",
  },
  {
    id: 103,
    name: "Wool Winter Scarf",
    slug: "wool-winter-scarf",
    permalink: "https://mockstore.local/product/wool-winter-scarf",
    sku: "SCF-003",
    price: "35.00",
    regular_price: "35.00",
    sale_price: "",
    on_sale: false,
    stock_status: "outofstock",
    stock_quantity: 0,
    manage_stock: true,
    short_description: "Warm knitted scarf.",
    description: "<p>Hand-knitted pure merino wool.</p>",
    categories: [{ id: 3, name: "Accessories", slug: "accessories" }],
    images: [],
    date_created: "2026-01-10T16:00:00",
  },
];

export const SAMPLE_ORDERS = [
  {
    id: 501,
    number: "501",
    status: "processing",
    currency: "USD",
    date_created: "2026-02-01T10:15:00",
    date_modified: "2026-02-01T10:20:00",
    total: "229.49",
    discount_total: "0.00",
    shipping_total: "15.00",
    total_tax: "14.50",
    payment_method_title: "Stripe Credit Card",
    customer_id: 12,
    billing: {
      first_name: "Alice",
      last_name: "Smith",
      email: "alice.smith@example.com",
      city: "Portland",
      state: "OR",
      country: "US",
      postcode: "97201",
    },
    shipping: {
      city: "Portland",
      state: "OR",
      country: "US",
      postcode: "97201",
    },
    line_items: [
      {
        id: 1,
        name: "Classic Leather Jacket",
        product_id: 101,
        variation_id: 0,
        quantity: 1,
        subtotal: "199.99",
        total: "199.99",
        sku: "JKT-001",
        price: 199.99,
      },
    ],
  },
  {
    id: 502,
    number: "502",
    status: "completed",
    currency: "USD",
    date_created: "2026-02-03T14:45:00",
    date_modified: "2026-02-04T09:00:00",
    total: "59.00",
    discount_total: "0.00",
    shipping_total: "0.00",
    total_tax: "0.00",
    payment_method_title: "PayPal",
    customer_id: 18,
    billing: {
      first_name: "Bob",
      last_name: "Jones",
      email: "bob.jones@example.com",
      city: "Austin",
      state: "TX",
      country: "US",
      postcode: "78701",
    },
    shipping: {
      city: "Austin",
      state: "TX",
      country: "US",
      postcode: "78701",
    },
    line_items: [
      {
        id: 2,
        name: "Cotton Crewneck T-Shirt",
        product_id: 102,
        variation_id: 0,
        quantity: 2,
        subtotal: "59.00",
        total: "59.00",
        sku: "TSH-002",
        price: 29.5,
      },
    ],
  },
];

export function startMockWooCommerceServer(port = 0) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const pathname = url.pathname;

      // Check simulate parameter
      const simulate = url.searchParams.get("simulate");
      if (simulate === "429") {
        res.writeHead(429, {
          "Content-Type": "application/json",
          "Retry-After": "1",
        });
        res.end(JSON.stringify({ code: "woocommerce_rest_rate_limit", message: "Rate limit exceeded" }));
        return;
      }
      if (simulate === "503") {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ code: "service_unavailable", message: "Service temporarily unavailable" }));
        return;
      }
      if (simulate === "malformed") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end("{ invalid json string ");
        return;
      }

      // Check auth header
      const authHeader = req.headers["authorization"] || "";
      if (!authHeader.startsWith("Basic ")) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ code: "woocommerce_rest_cannot_view", message: "Authentication credentials missing" }));
        return;
      }

      // Decode basic auth
      const creds = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
      const [key, secret] = creds.split(":");
      if (key === "invalid_key" || secret === "invalid_secret") {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ code: "woocommerce_rest_authentication_error", message: "Consumer key or secret invalid" }));
        return;
      }
      if (key === "forbidden_key") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ code: "woocommerce_rest_cannot_view", message: "Forbidden scope" }));
        return;
      }

      // Products listing: GET /wp-json/wc/v3/products
      if (pathname === "/wp-json/wc/v3/products") {
        let results = [...SAMPLE_PRODUCTS];
        const search = url.searchParams.get("search");
        if (search) {
          results = results.filter((p) =>
            p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()),
          );
        }
        const stockStatus = url.searchParams.get("stock_status");
        if (stockStatus) {
          results = results.filter((p) => p.stock_status === stockStatus);
        }

        const perPage = parseInt(url.searchParams.get("per_page") || "10", 10);
        const page = parseInt(url.searchParams.get("page") || "1", 10);
        const totalItems = results.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / perPage));

        res.writeHead(200, {
          "Content-Type": "application/json",
          "x-wp-total": String(totalItems),
          "x-wp-totalpages": String(totalPages),
        });
        res.end(JSON.stringify(results.slice((page - 1) * perPage, page * perPage)));
        return;
      }

      // Single product: GET /wp-json/wc/v3/products/:id
      const productMatch = pathname.match(/^\/wp-json\/wc\/v3\/products\/(\d+)$/);
      if (productMatch) {
        const id = parseInt(productMatch[1], 10);
        const product = SAMPLE_PRODUCTS.find((p) => p.id === id);
        if (!product) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ code: "woocommerce_rest_product_invalid_id", message: "Invalid ID." }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(product));
        return;
      }

      // Orders listing: GET /wp-json/wc/v3/orders
      if (pathname === "/wp-json/wc/v3/orders") {
        let results = [...SAMPLE_ORDERS];
        const status = url.searchParams.get("status");
        if (status && status !== "any") {
          results = results.filter((o) => o.status === status);
        }
        const search = url.searchParams.get("search");
        if (search) {
          results = results.filter((o) =>
            o.billing.email.toLowerCase().includes(search.toLowerCase()) ||
            o.number.includes(search)
          );
        }

        const perPage = parseInt(url.searchParams.get("per_page") || "10", 10);
        const page = parseInt(url.searchParams.get("page") || "1", 10);
        const totalItems = results.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / perPage));

        res.writeHead(200, {
          "Content-Type": "application/json",
          "x-wp-total": String(totalItems),
          "x-wp-totalpages": String(totalPages),
        });
        res.end(JSON.stringify(results.slice((page - 1) * perPage, page * perPage)));
        return;
      }

      // Single order: GET /wp-json/wc/v3/orders/:id
      const orderMatch = pathname.match(/^\/wp-json\/wc\/v3\/orders\/(\d+)$/);
      if (orderMatch) {
        const id = parseInt(orderMatch[1], 10);
        const order = SAMPLE_ORDERS.find((o) => o.id === id);
        if (!order) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ code: "woocommerce_rest_order_invalid_id", message: "Invalid ID." }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(order));
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ code: "not_found", message: "Route not found" }));
    });

    server.listen(port, () => {
      const addr = server.address();
      const actualPort = typeof addr === "object" && addr ? addr.port : port;
      resolve({ server, port: actualPort, url: `http://127.0.0.1:${actualPort}` });
    });

    server.on("error", reject);
  });
}
