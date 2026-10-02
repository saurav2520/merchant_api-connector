import assert from "node:assert";
import {
  isPrivateOrReservedIPv4,
  isPrivateOrReservedIPv6,
  validateMerchantUrl,
} from "../../dist/security/url-validation.js";

console.log("Running URL Validation & SSRF Protection Tests...");

// 1. Private IPv4 tests
assert.strictEqual(isPrivateOrReservedIPv4("127.0.0.1"), true, "127.0.0.1 should be private");
assert.strictEqual(isPrivateOrReservedIPv4("10.0.1.5"), true, "10.0.1.5 should be private");
assert.strictEqual(isPrivateOrReservedIPv4("172.16.0.1"), true, "172.16.0.1 should be private");
assert.strictEqual(isPrivateOrReservedIPv4("172.31.255.255"), true, "172.31.255.255 should be private");
assert.strictEqual(isPrivateOrReservedIPv4("192.168.1.1"), true, "192.168.1.1 should be private");
assert.strictEqual(isPrivateOrReservedIPv4("169.254.169.254"), true, "169.254.169.254 (AWS metadata) should be private");
assert.strictEqual(isPrivateOrReservedIPv4("100.64.0.1"), true, "100.64.0.1 (Carrier NAT) should be private");
assert.strictEqual(isPrivateOrReservedIPv4("8.8.8.8"), false, "8.8.8.8 should be public");
assert.strictEqual(isPrivateOrReservedIPv4("93.184.216.34"), false, "93.184.216.34 should be public");

// 2. Private IPv6 tests
assert.strictEqual(isPrivateOrReservedIPv6("::1"), true, "::1 (loopback) should be private");
assert.strictEqual(isPrivateOrReservedIPv6("fe80::1"), true, "fe80::1 (link-local) should be private");
assert.strictEqual(isPrivateOrReservedIPv6("fc00::1"), true, "fc00::1 (unique local) should be private");
assert.strictEqual(isPrivateOrReservedIPv6("2607:f8b0:4005:805::200e"), false, "Google IPv6 should be public");

// 3. validateMerchantUrl protocol tests
await assert.rejects(
  async () => validateMerchantUrl("ftp://shop.example.com"),
  (err) => err.code === "UNSUPPORTED_PROTOCOL" || err.message.includes("Unsupported protocol"),
  "Should reject ftp protocol",
);

await assert.rejects(
  async () => validateMerchantUrl("http://shop.example.com", { allowInsecureHttp: false }),
  (err) => err.code === "HTTPS_REQUIRED" || err.message.includes("HTTPS is required"),
  "Should reject insecure HTTP when allowInsecureHttp is false",
);

// 4. validateMerchantUrl credentials embedded tests
await assert.rejects(
  async () => validateMerchantUrl("https://admin:secret@shop.example.com"),
  (err) => err.code === "CREDENTIALS_IN_URL" || err.message.includes("Credentials must not be embedded"),
  "Should reject credentials embedded in URL",
);

// 5. validateMerchantUrl SSRF hosts tests
await assert.rejects(
  async () => validateMerchantUrl("https://localhost/wp-json", { allowInsecureHttp: false }),
  (err) => err.code === "SSRF_FORBIDDEN_HOST" || err.message.includes("prohibited"),
  "Should reject localhost",
);

await assert.rejects(
  async () => validateMerchantUrl("https://127.0.0.1/wp-json", { allowInsecureHttp: false }),
  (err) => err.code === "SSRF_PRIVATE_IP" || err.code === "SSRF_FORBIDDEN_HOST" || err.message.includes("prohibited"),
  "Should reject 127.0.0.1",
);

await assert.rejects(
  async () => validateMerchantUrl("https://169.254.169.254/latest/meta-data", { allowInsecureHttp: false }),
  (err) => err.code === "SSRF_PRIVATE_IP" || err.message.includes("prohibited"),
  "Should reject AWS metadata IP",
);

// 6. Valid URL test
const validUrl = await validateMerchantUrl("https://store.example.com", {
  allowInsecureHttp: false,
  resolveDns: false,
});
assert.strictEqual(validUrl.origin, "https://store.example.com");

console.log("PASS: URL validation and SSRF protection tests passed.");
