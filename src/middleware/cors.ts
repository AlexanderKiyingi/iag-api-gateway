import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";
import type { GatewayEnv } from "../config.js";

/** Register browser CORS for gateway-facing SPAs. */
export async function registerCORS(
  app: FastifyInstance,
  env: GatewayEnv,
): Promise<void> {
  const origins = env.CORS_ALLOWED_ORIGINS;
  const allowAll = origins.length === 1 && origins[0] === "*";

  await app.register(cors, {
    origin: allowAll
      ? true
      : (origin, cb) => {
          if (!origin || origins.includes(origin)) {
            cb(null, true);
            return;
          }
          cb(null, false);
        },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "If-Match",
      "X-Request-ID",
      "X-Workspace-User",
      // Names the calling tool for usage attribution (usage.ts).
      "X-IAG-App",
    ],
    exposedHeaders: ["ETag", "X-Request-ID"],
    maxAge: 86_400,
  });
}

/** Resolve comma-separated CORS allowlist from env (canonical + legacy keys). */
export function parseCORSOrigins(source: NodeJS.ProcessEnv): string[] {
  const raw =
    source.CORS_ALLOWED_ORIGINS?.trim() ||
    source.CORS_ALLOW_ORIGIN?.trim() ||
    source.CORS_ORIGIN?.trim() ||
    source.ALLOWED_ORIGINS?.trim() ||
    source.CORS_ORIGINS?.trim() ||
    "http://localhost:3000,http://localhost:5173";

  if (raw === "*") {
    return ["*"];
  }

  return raw
    .split(",")
    .map((part) => normalizeOrigin(part))
    .filter(Boolean);
}

/**
 * An Origin header is only ever scheme://host[:port] — never a path, never a
 * trailing slash. Allowlists are hand-maintained in env vars and routinely
 * pasted from a browser address bar, so "https://app.example.com/" is a common
 * entry that silently never matches and reads as "CORS is broken for that one
 * app". Normalising here makes the allowlist forgiving of the way it is
 * actually written.
 */
function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function corsHasWildcard(origins: string[]): boolean {
  return origins.includes("*");
}
