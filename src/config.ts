import { z } from "zod";
import { baseEnvSchema, loadEnv } from "@iag/config";

const gatewayEnvSchema = baseEnvSchema.extend({
  JWT_ISSUER: z.string().url().default("http://localhost:3001"),
  JWKS_URL: z
    .string()
    .url()
    .default("http://localhost:3001/.well-known/jwks.json"),
  /** Shared with upstream services (AUTH_MODE=gateway) to trust forwarded principal headers. */
  GATEWAY_INTERNAL_SECRET: z.string().optional(),
});

export type GatewayEnv = z.infer<typeof gatewayEnvSchema>;

export function loadGatewayEnv(): GatewayEnv {
  return loadEnv(
    gatewayEnvSchema.extend({
      SERVICE_NAME: baseEnvSchema.shape.SERVICE_NAME.default("api-gateway"),
      PORT: baseEnvSchema.shape.PORT.default(8080),
    }),
  );
}
