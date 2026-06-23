import { z, type ZodIssue } from "zod";
import { baseEnvSchema } from "@iag/config";
import { corsHasWildcard, parseCORSOrigins } from "./middleware/cors.js";

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
      "https://financeiag.vercel.app",
    ]),
    /** Set true when behind nginx / a load balancer (X-Forwarded-*). */
    TRUST_PROXY: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    /** Probe upstream /ready endpoints when handling GET /ready. */
    READY_PROBE_UPSTREAMS: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    OAUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
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
      .map((issue: ZodIssue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${message}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === "production" && corsHasWildcard(env.CORS_ALLOWED_ORIGINS)) {
    throw new Error("CORS allowlist must not include '*' when NODE_ENV=production");
  }
  return env;
}
