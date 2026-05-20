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
    /** Optional; authentication does not set aud today — enable when tokens include audience. */
    JWT_AUDIENCE: z.string().min(1).optional(),
    /** Shared with upstream services (AUTH_MODE=gateway) to trust forwarded principal headers. */
    GATEWAY_INTERNAL_SECRET: z.string().optional(),
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
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;
    const secret = env.GATEWAY_INTERNAL_SECRET?.trim();
    if (!secret || secret.length < 16) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["GATEWAY_INTERNAL_SECRET"],
        message:
          "required in production (min 16 characters) — must match upstream AUTH_MODE=gateway services",
      });
    }
  });

export type GatewayEnv = z.infer<typeof gatewayEnvSchema>;

export function loadGatewayEnv(): GatewayEnv {
  return loadEnv(gatewayEnvSchema);
}
