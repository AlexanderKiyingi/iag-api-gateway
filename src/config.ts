import { z } from "zod";
import { baseEnvSchema, loadEnv } from "@iag/config";

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
    /** OTLP endpoint for traces. Empty disables OTel. */
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default("http://otel-collector:4318"),
  });

export type GatewayEnv = z.infer<typeof gatewayEnvSchema>;

export function loadGatewayEnv(): GatewayEnv {
  return loadEnv(gatewayEnvSchema);
}
