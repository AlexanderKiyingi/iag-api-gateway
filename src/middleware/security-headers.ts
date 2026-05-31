import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

/**
 * Emit baseline browser security headers on every response, including
 * responses proxied through @fastify/http-proxy. Without this the gateway
 * surfaces none of the per-service headers (the proxy plugin doesn't forward
 * arbitrary upstream response headers) and Railway's edge adds nothing — so
 * a first-load HSTS-stripping MITM, MIME-sniffing, and clickjacking are all
 * undefended at the public boundary.
 *
 * Header choices match the strictest hardening for an API surface (no HTML,
 * so CSP can lock everything down to 'none' and COOP/CORP can be 'same-origin').
 * Per-route overrides can be added via reply.header() in the handler — Fastify
 * gives the route handler precedence over onSend hooks set earlier.
 */
const HEADERS: Record<string, string> = {
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "content-security-policy":
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
};

export function registerSecurityHeaders(app: FastifyInstance) {
  app.addHook(
    "onSend",
    async (_request: FastifyRequest, reply: FastifyReply, payload) => {
      for (const [name, value] of Object.entries(HEADERS)) {
        if (!reply.getHeader(name)) {
          reply.header(name, value);
        }
      }
      return payload;
    },
  );
}
