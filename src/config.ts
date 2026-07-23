import { z } from "zod";
import { baseEnvSchema } from "@iag/config";
import { corsHasWildcard, parseCORSOrigins } from "./middleware/cors.js";

/**
 * Parse the TRUST_PROXY env into a value Fastify (via proxy-addr) understands,
 * so the rate limiter and access logs key on the REAL client IP rather than a
 * spoofable or collapsed one. Accepts:
 *   - "false"/"" → trust nothing; request.ip is the socket peer. Behind an edge
 *     (Railway) this makes every client look like the edge, collapsing the
 *     per-IP limiter into one global bucket.
 *   - "true" → trust every hop; request.ip is the LEFT-most X-Forwarded-For
 *     entry. ⚠ Fully client-spoofable — do not use in production.
 *   - a positive integer N → trust N proxy hops closest to the server and read
 *     the (N+1)-th-from-the-right XFF entry. This is the correct, NON-spoofable
 *     setting behind a known edge: on Railway set it to the number of edge hops
 *     in front of the gateway (usually "1"). Client-prepended XFF is ignored.
 *   - a comma-separated list of trusted proxy IPs / CIDRs.
 */
export function parseTrustProxy(raw: string): boolean | number | string[] {
  const v = (raw ?? "").trim();
  if (v === "" || v.toLowerCase() === "false") return false;
  if (v.toLowerCase() === "true") return true;
  if (/^\d+$/.test(v)) return Number(v);
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const gatewayEnvSchema = baseEnvSchema
  .extend({
    SERVICE_NAME: z.string().min(1).default("api-gateway"),
    PORT: z.coerce.number().int().positive().default(8080),
    JWT_ISSUER: z.string().url().default("http://localhost:3001"),
    JWKS_URL: z
      .string()
      .url()
      .default("http://localhost:3001/.well-known/jwks.json"),
    /** REQUIRED post-cutover. Tokens must carry this audience in their aud
     *  claim array (typically "iag.gateway"). Backends each verify their own
     *  audience separately. */
    JWT_AUDIENCE: z.string().min(1).default("iag.gateway"),
    /** Comma-separated browser origins (canonical: CORS_ALLOWED_ORIGINS). */
    CORS_ALLOWED_ORIGINS: z.array(z.string().min(1)).default([
      "http://localhost:3000",
      "http://localhost:5173",
    ]),
    /**
     * Trusted-proxy setting for client-IP derivation (see parseTrustProxy).
     * Behind Railway's edge this SHOULD be the edge hop count (e.g. "1") so the
     * rate limiter keys on the real, non-spoofable client IP. "true" trusts a
     * client-supplied X-Forwarded-For and is spoofable; "false" collapses all
     * traffic to the edge IP.
     */
    TRUST_PROXY: z.string().default("false").transform(parseTrustProxy),
    /** Probe upstream /ready endpoints when handling GET /ready. */
    READY_PROBE_UPSTREAMS: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    OAUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
    /** Tighter per-window cap for abuse-prone unauthenticated auth endpoints
     *  (password reset/forgot, token revoke, account provisioning, PAT/share
     *  token minting). Defence-in-depth in front of the auth service's own
     *  per-endpoint limits. */
    SENSITIVE_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(15),
    /** Max incoming request-header size (bytes). Raised above Node's ~16 KB
     *  default so large multi-aud / granular-permission JWTs (+ cookies) don't
     *  get rejected with HTTP 431 before reaching an upstream. */
    MAX_HEADER_SIZE: z.coerce.number().int().positive().default(65_536),
    /** OTLP endpoint for traces. Empty disables OTel. */
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default("http://otel-collector:4318"),
  });

export type GatewayEnv = z.infer<typeof gatewayEnvSchema>;

export function loadGatewayEnv(): GatewayEnv {
  const corsOrigins = parseCORSOrigins(process.env);
  const parsed = gatewayEnvSchema.safeParse({
    ...process.env,
    CORS_ALLOWED_ORIGINS: corsOrigins,
  });
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${message}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === "production" && corsHasWildcard(env.CORS_ALLOWED_ORIGINS)) {
    throw new Error("CORS allowlist must not include '*' when NODE_ENV=production");
  }
  return env;
}
