import * as dns from "node:dns/promises";
import * as net from "node:net";
import { SecurityError } from "../errors/error-handler.js";

export interface UrlValidationOptions {
  allowInsecureHttp?: boolean;
  allowedOrigins?: string[];
  resolveDns?: boolean;
}

/**
 * Checks whether an IPv4 address belongs to private, loopback, or link-local ranges.
 */
export function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // invalid IP format considered unsafe
  }

  const [b0, b1] = parts;

  // 0.0.0.0/8 (Current network)
  if (b0 === 0) return true;
  // 10.0.0.0/8 (Private network)
  if (b0 === 10) return true;
  // 100.64.0.0/10 (Shared address space / Carrier-grade NAT)
  if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;
  // 127.0.0.0/8 (Loopback)
  if (b0 === 127) return true;
  // 169.254.0.0/16 (Link-local / Cloud metadata: 169.254.169.254)
  if (b0 === 169 && b1 === 254) return true;
  // 172.16.0.0/12 (Private network)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (b0 === 192 && b1 === 0 && parts[2] === 0) return true;
  // 192.0.2.0/24 (TEST-NET-1)
  if (b0 === 192 && b1 === 0 && parts[2] === 2) return true;
  // 192.168.0.0/16 (Private network)
  if (b0 === 192 && b1 === 168) return true;
  // 198.18.0.0/15 (Benchmarking)
  if (b0 === 198 && (b1 === 18 || b1 === 19)) return true;
  // 198.51.100.0/24 (TEST-NET-2)
  if (b0 === 198 && b1 === 51 && parts[2] === 100) return true;
  // 203.0.113.0/24 (TEST-NET-3)
  if (b0 === 203 && b1 === 0 && parts[2] === 113) return true;
  // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
  if (b0 >= 224) return true;

  return false;
}

/**
 * Checks whether an IPv6 address is loopback, unique local, or link-local.
 */
export function isPrivateOrReservedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().trim();
  // Loopback (::1) and unspecified (::)
  if (normalized === "::1" || normalized === "::") return true;

  // IPv4-mapped IPv6 (::ffff:127.0.0.1, etc.)
  if (normalized.startsWith("::ffff:")) {
    const v4 = normalized.slice(7);
    if (net.isIPv4(v4)) return isPrivateOrReservedIPv4(v4);
  }

  // Unique local address fc00::/7 (fc00:: to fdff::)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;

  // Link-local address fe80::/10 (fe80:: to febf::)
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return true;
  }

  // Multicast ff00::/8
  if (normalized.startsWith("ff")) return true;

  return false;
}

/**
 * Validates a merchant store URL against SSRF and formatting rules.
 */
export async function validateMerchantUrl(rawUrl: string, options: UrlValidationOptions = {}): Promise<URL> {
  const trimmed = (rawUrl ?? "").trim();
  if (!trimmed) {
    throw new SecurityError("Merchant store URL is required.", "MISSING_MERCHANT_URL");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new SecurityError(`Invalid merchant store URL format: '${trimmed}'.`, "INVALID_MERCHANT_URL");
  }

  // Enforce protocol
  const isHttps = parsed.protocol === "https:";
  const isHttp = parsed.protocol === "http:";
  if (!isHttps && !isHttp) {
    throw new SecurityError(`Unsupported protocol '${parsed.protocol}'. Only HTTPS is permitted.`, "UNSUPPORTED_PROTOCOL");
  }

  if (isHttp && !options.allowInsecureHttp) {
    throw new SecurityError("Insecure HTTP is forbidden for merchant connections. HTTPS is required.", "HTTPS_REQUIRED");
  }

  // Disallow user/pass credentials embedded in the URL
  if (parsed.username || parsed.password) {
    throw new SecurityError("Credentials must not be embedded in the merchant store URL.", "CREDENTIALS_IN_URL");
  }

  const hostname = parsed.hostname.toLowerCase();

  // Hostname blocklist
  const blockedHostnames = ["localhost", "127.0.0.1", "0.0.0.0", "metadata.google.internal", "instance-data"];
  if (blockedHostnames.includes(hostname) || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    if (!options.allowInsecureHttp) {
      throw new SecurityError(`Access to internal/loopback host '${hostname}' is prohibited.`, "SSRF_FORBIDDEN_HOST");
    }
  }

  // Check if IP literal
  if (net.isIP(hostname)) {
    const isPrivate = net.isIPv4(hostname) ? isPrivateOrReservedIPv4(hostname) : isPrivateOrReservedIPv6(hostname);
    if (isPrivate && !options.allowInsecureHttp) {
      throw new SecurityError(`Access to private or reserved IP address '${hostname}' is prohibited.`, "SSRF_PRIVATE_IP");
    }
  } else if (options.resolveDns && !options.allowInsecureHttp) {
    // Resolve DNS to prevent DNS rebinding attacks to private IPs
    try {
      const addresses = await dns.lookup(hostname, { all: true });
      for (const addr of addresses) {
        const isPrivate = addr.family === 4 ? isPrivateOrReservedIPv4(addr.address) : isPrivateOrReservedIPv6(addr.address);
        if (isPrivate) {
          throw new SecurityError(
            `Merchant host '${hostname}' resolved to prohibited address '${addr.address}'.`,
            "SSRF_RESOLVED_PRIVATE_IP",
          );
        }
      }
    } catch (err) {
      if (err instanceof SecurityError) throw err;
      throw new SecurityError(`Unable to resolve merchant hostname '${hostname}': ${(err as Error).message}`, "DNS_RESOLUTION_FAILED");
    }
  }

  // Enforce allowlisted origin if configured
  if (options.allowedOrigins && options.allowedOrigins.length > 0) {
    const origin = parsed.origin.toLowerCase();
    if (!options.allowedOrigins.map((o) => o.toLowerCase()).includes(origin)) {
      throw new SecurityError(`Store origin '${origin}' is not in the approved merchant origin allowlist.`, "ORIGIN_NOT_ALLOWED");
    }
  }

  return parsed;
}
