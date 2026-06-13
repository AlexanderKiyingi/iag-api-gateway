/** Upstream routes for platform services — extend as domain services are added */

export interface UpstreamRoute {
  upstream: string;
  prefix: string;
  rewritePrefix: string;
  /** Enable WebSocket upgrade proxying for this upstream (e.g. /v1/ws/*). */
  websocket?: boolean;
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
  /** @deprecated Legacy finance prefix — use /api/v1/finance. RBAC mirrors finance.*; user/org data is under /api/v1/users. */
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
    websocket: true,
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
  "/api/v1/traceability": {
    upstream: upstream("UPSTREAM_TRACEABILITY", "http://127.0.0.1:4011"),
    prefix: "/api/v1/traceability",
    rewritePrefix: "/",
  },
  "/api/v1/warehouse": {
    upstream: upstream("UPSTREAM_WAREHOUSE", "http://127.0.0.1:4005"),
    prefix: "/api/v1/warehouse",
    rewritePrefix: "/",
  },
  "/api/v1/mes": {
    upstream: upstream("UPSTREAM_MES", "http://127.0.0.1:4003"),
    prefix: "/api/v1/mes",
    rewritePrefix: "/",
  },
  "/api/v1/erp": {
    upstream: upstream("UPSTREAM_ERP", "http://127.0.0.1:4001"),
    prefix: "/api/v1/erp",
    rewritePrefix: "/",
  },
  "/api/v1/production": {
    upstream: upstream("UPSTREAM_PRODUCTION", "http://127.0.0.1:4002"),
    prefix: "/api/v1/production",
    rewritePrefix: "/",
  },
  "/api/v1/quality-control": {
    upstream: upstream("UPSTREAM_QUALITY_CONTROL", "http://127.0.0.1:4004"),
    prefix: "/api/v1/quality-control",
    rewritePrefix: "/",
  },
};

/** Longest-prefix match for gateway paths (fleet IoT before fleet, etc.). */
export function matchUpstreamRoute(gatewayPath: string): UpstreamRoute | undefined {
  const sorted = sortedUpstreamRoutes();
  return sorted.find(
    (route) =>
      gatewayPath === route.prefix ||
      gatewayPath.startsWith(`${route.prefix}/`),
  );
}

/** Path sent to the upstream after prefix rewrite (mirrors @fastify/http-proxy). */
export function rewriteUpstreamPath(
  gatewayPath: string,
  route: UpstreamRoute,
): string {
  if (
    gatewayPath !== route.prefix &&
    !gatewayPath.startsWith(`${route.prefix}/`)
  ) {
    throw new Error(
      `path ${gatewayPath} does not match upstream prefix ${route.prefix}`,
    );
  }
  const suffix =
    gatewayPath === route.prefix ? "" : gatewayPath.slice(route.prefix.length);
  if (route.rewritePrefix === "/") {
    return suffix || "/";
  }
  return `${route.rewritePrefix}${suffix}`;
}

/** Upstream routes sorted longest prefix first — use when registering proxies. */
export function sortedUpstreamRoutes(): UpstreamRoute[] {
  return Object.values(upstreamRoutes).sort(
    (a, b) => b.prefix.length - a.prefix.length,
  );
}

/** True when the path is proxied to a platform service (must have an explicit route policy). */
export function isProxiedPath(path: string): boolean {
  return matchUpstreamRoute(path) !== undefined;
}
