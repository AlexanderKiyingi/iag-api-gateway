/** Upstream routes for platform services — extend as domain services are added */

export interface UpstreamRoute {
  upstream: string;
  prefix: string;
  rewritePrefix: string;
}

function upstream(envKey: string, fallback: string): string {
  return process.env[envKey]?.trim() || fallback;
}

/** Resolved at process start (override via UPSTREAM_* in Docker Compose). */
export const upstreamRoutes: Record<string, UpstreamRoute> = {
  "/api/v1/authentication": {
    upstream: upstream("UPSTREAM_AUTHENTICATION", "http://127.0.0.1:3001"),
    prefix: "/api/v1/authentication",
    rewritePrefix: "/",
  },
  "/api/v1/notifications": {
    upstream: upstream("UPSTREAM_NOTIFICATIONS", "http://127.0.0.1:3002"),
    prefix: "/api/v1/notifications",
    rewritePrefix: "/",
  },
  "/api/v1/reports": {
    upstream: upstream("UPSTREAM_REPORTS", "http://127.0.0.1:3003"),
    prefix: "/api/v1/reports",
    rewritePrefix: "/",
  },
  "/api/v1/users": {
    upstream: upstream("UPSTREAM_USERS", "http://127.0.0.1:3005"),
    prefix: "/api/v1/users",
    rewritePrefix: "/",
  },
  /** @deprecated Legacy prefix — proxies to iag-finance until clients migrate to /api/v1/finance */
  "/api/v1/accounts": {
    upstream: upstream("UPSTREAM_ACCOUNTS", "http://127.0.0.1:3006"),
    prefix: "/api/v1/accounts",
    rewritePrefix: "/",
  },
  "/api/v1/finance": {
    upstream: upstream("UPSTREAM_FINANCE", "http://127.0.0.1:3006"),
    prefix: "/api/v1/finance",
    rewritePrefix: "/",
  },
  "/api/v1/supply-chain": {
    upstream: upstream("UPSTREAM_SUPPLY_CHAIN", "http://127.0.0.1:4007"),
    prefix: "/api/v1/supply-chain",
    rewritePrefix: "/",
  },
  /** Device HTTP ingest (Fleet_IoT) — must register before /api/v1/fleet. */
  "/api/v1/fleet/api/iot/pings": {
    upstream: upstream("UPSTREAM_FLEET_IOT_INGEST", "http://127.0.0.1:4080"),
    prefix: "/api/v1/fleet/api/iot/pings",
    rewritePrefix: "/api/iot/pings",
  },
  "/api/v1/fleet": {
    upstream: upstream("UPSTREAM_FLEET", "http://127.0.0.1:4008"),
    prefix: "/api/v1/fleet",
    rewritePrefix: "/",
  },
  "/api/v1/project-management": {
    upstream: upstream("UPSTREAM_PROJECT_MANAGEMENT", "http://127.0.0.1:4102"),
    prefix: "/api/v1/project-management",
    rewritePrefix: "/",
  },
  "/api/v1/procurement": {
    upstream: upstream("UPSTREAM_PROCUREMENT", "http://127.0.0.1:4009"),
    prefix: "/api/v1/procurement",
    rewritePrefix: "/",
  },
  "/api/v1/contract-management": {
    upstream: upstream("UPSTREAM_CONTRACT_MANAGEMENT", "http://127.0.0.1:4103"),
    prefix: "/api/v1/contract-management",
    rewritePrefix: "/",
  },
  "/api/v1/crm": {
    upstream: upstream("UPSTREAM_CRM", "http://127.0.0.1:4101"),
    prefix: "/api/v1/crm",
    rewritePrefix: "/",
  },
  "/api/v1/dms": {
    upstream: upstream("UPSTREAM_DMS", "http://127.0.0.1:4010"),
    prefix: "/api/v1/dms",
    rewritePrefix: "/",
  },
};

/** True when the path is proxied to a platform service (must have an explicit route policy). */
export function isProxiedPath(path: string): boolean {
  return Object.keys(upstreamRoutes).some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
