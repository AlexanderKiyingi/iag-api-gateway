import type { IncomingHttpHeaders } from "node:http";
import type { IncomingHttpHeaders as Http2IncomingHttpHeaders } from "node:http2";

/**
 * Replace the client's forwarding headers with the address the gateway itself
 * resolved, before a request is proxied upstream.
 *
 * Left alone, the X-Forwarded-For a caller sends arrives at the service intact
 * (Railway's edge appends to it rather than replacing it). The Go services read
 * it with gin's ClientIP(), which trusts every proxy unless TRUSTED_PROXIES is
 * set, and so takes the left-most entry — the one the caller wrote. Their
 * per-IP rate limits and audit-log IPs are then whatever the caller chooses.
 *
 * request.ip has already been through TRUST_PROXY, so it is the real client.
 * Sending exactly one entry means a service reads the same answer however many
 * proxies it is told to trust.
 */
export function forwardResolvedClientIP(
  request: { ip: string },
  headers: IncomingHttpHeaders | Http2IncomingHttpHeaders,
): IncomingHttpHeaders | Http2IncomingHttpHeaders {
  const out = { ...headers };
  delete out.forwarded;
  out["x-forwarded-for"] = request.ip;
  out["x-real-ip"] = request.ip;
  return out;
}
