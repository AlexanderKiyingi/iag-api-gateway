/** Upstream routes for platform services — extend as domain services are added */

export interface UpstreamRoute {
  upstream: string;
  prefix: string;
  rewritePrefix: string;
  /** Enable WebSocket upgrade proxying for this upstream (e.g. /v1/ws/*). */
  websocket?: boolean;
  /**
   * The UPSTREAM_* variable this route reads. Carried so an unconfigured route
   * can name the exact variable to set, instead of reporting a generic
   * "service unavailable" that reads as an outage rather than a missing
   * deployment.
   */
  envKey: string;
}

function upstream(envKey: string, fallback: string): string {
  return process.env[envKey]?.trim() || fallback;
}

/**
 * True when an upstream points at this container rather than at a service.
 *
 * In development this is correct — everything runs on localhost. In production
 * it means the UPSTREAM_* variable is unset and the route fell back to the
 * default in this file, so every request to it will fail on connect.
 */
export function isLoopbackUpstream(target: string): boolean {
  let host: string;
  try {
    host = new URL(target).hostname;
  } catch {
    return false;
  }
  return host === "127.0.0.1" || host === "localhost" || host === "::1" || host === "[::1]";
}

/** Resolved at process start (override via UPSTREAM_* in Docker Compose). */
export const upstreamRoutes: Record<string, UpstreamRoute> = {
  "/api/v1/authentication": {
    envKey: "UPSTREAM_AUTHENTICATION",
    upstream: upstream("UPSTREAM_AUTHENTICATION", "http://127.0.0.1:3001"),
    prefix: "/api/v1/authentication",
    rewritePrefix: "/",
  },
  "/api/v1/notifications": {
    envKey: "UPSTREAM_NOTIFICATIONS",
    upstream: upstream("UPSTREAM_NOTIFICATIONS", "http://127.0.0.1:3002"),
    prefix: "/api/v1/notifications",
    rewritePrefix: "/",
    // In-app realtime WebSocket at /v1/realtime/ws (SSE at /v1/realtime/stream
    // is plain HTTP and proxies without this flag).
    websocket: true,
  },
  "/api/v1/chat": {
    envKey: "UPSTREAM_CHAT",
    // 8085 is what iag-chat actually listens on (its EXPOSE, its .env.example
    // and its PORT default all agree). The 4104 this used to carry belongs to
    // no service, so running chat locally never reached it.
    upstream: upstream("UPSTREAM_CHAT", "http://127.0.0.1:8085"),
    prefix: "/api/v1/chat",
    rewritePrefix: "/",
    // Realtime chat WebSocket at /api/v1/chat/v1/realtime/ws (?token= auth over
    // the socket); SSE at /v1/realtime/stream is plain HTTP and needs no flag.
    websocket: true,
  },
  "/api/v1/users": {
    envKey: "UPSTREAM_USERS",
    upstream: upstream("UPSTREAM_USERS", "http://127.0.0.1:3005"),
    prefix: "/api/v1/users",
    rewritePrefix: "/",
  },
  /** @deprecated Legacy finance prefix — use /api/v1/finance. RBAC mirrors finance.*; user/org data is under /api/v1/users. */
  "/api/v1/accounts": {
    envKey: "UPSTREAM_ACCOUNTS",
    // An alias resolves to whatever finance resolved to. Giving it its own
    // variable meant production could configure finance and leave this unset,
    // which is exactly what happened: the alias alone was dead while the
    // service it aliases was healthy. Setting UPSTREAM_ACCOUNTS still wins, for
    // the one case that would justify it — pointing the legacy prefix at a
    // different finance deployment during a migration.
    upstream: upstream(
      "UPSTREAM_ACCOUNTS",
      upstream("UPSTREAM_FINANCE", "http://127.0.0.1:3006"),
    ),
    prefix: "/api/v1/accounts",
    rewritePrefix: "/",
  },
  "/api/v1/finance": {
    envKey: "UPSTREAM_FINANCE",
    upstream: upstream("UPSTREAM_FINANCE", "http://127.0.0.1:3006"),
    prefix: "/api/v1/finance",
    rewritePrefix: "/",
    // Realtime channel at /api/v1/finance/v1/ws/events (auth over the socket).
    websocket: true,
  },
  "/api/v1/supply-chain": {
    envKey: "UPSTREAM_SUPPLY_CHAIN",
    upstream: upstream("UPSTREAM_SUPPLY_CHAIN", "http://127.0.0.1:4007"),
    prefix: "/api/v1/supply-chain",
    rewritePrefix: "/",
  },
  /** Device HTTP ingest (Fleet_IoT) — must register before /api/v1/fleet. */
  "/api/v1/fleet/api/iot/pings": {
    envKey: "UPSTREAM_FLEET_IOT_INGEST",
    upstream: upstream("UPSTREAM_FLEET_IOT_INGEST", "http://127.0.0.1:4080"),
    prefix: "/api/v1/fleet/api/iot/pings",
    rewritePrefix: "/api/iot/pings",
  },
  "/api/v1/fleet": {
    envKey: "UPSTREAM_FLEET",
    upstream: upstream("UPSTREAM_FLEET", "http://127.0.0.1:4008"),
    prefix: "/api/v1/fleet",
    rewritePrefix: "/",
    // Realtime WebSocket bridge at /api/v1/fleet/api/realtime/ws (?token= auth).
    websocket: true,
  },
  "/api/v1/project-management": {
    envKey: "UPSTREAM_PROJECT_MANAGEMENT",
    upstream: upstream("UPSTREAM_PROJECT_MANAGEMENT", "http://127.0.0.1:4102"),
    prefix: "/api/v1/project-management",
    rewritePrefix: "/",
    websocket: true,
  },
  "/api/v1/procurement": {
    envKey: "UPSTREAM_PROCUREMENT",
    upstream: upstream("UPSTREAM_PROCUREMENT", "http://127.0.0.1:4009"),
    prefix: "/api/v1/procurement",
    rewritePrefix: "/",
  },
  "/api/v1/contract-management": {
    envKey: "UPSTREAM_CONTRACT_MANAGEMENT",
    upstream: upstream("UPSTREAM_CONTRACT_MANAGEMENT", "http://127.0.0.1:4103"),
    prefix: "/api/v1/contract-management",
    rewritePrefix: "/",
    websocket: true,
  },
  "/api/v1/crm": {
    envKey: "UPSTREAM_CRM",
    upstream: upstream("UPSTREAM_CRM", "http://127.0.0.1:4101"),
    prefix: "/api/v1/crm",
    rewritePrefix: "/",
  },
  "/api/v1/dms": {
    envKey: "UPSTREAM_DMS",
    upstream: upstream("UPSTREAM_DMS", "http://127.0.0.1:4010"),
    prefix: "/api/v1/dms",
    rewritePrefix: "/",
  },
  "/api/v1/traceability": {
    envKey: "UPSTREAM_TRACEABILITY",
    upstream: upstream("UPSTREAM_TRACEABILITY", "http://127.0.0.1:4011"),
    prefix: "/api/v1/traceability",
    rewritePrefix: "/",
  },
  /** TraceAG portal BFF — owns farmers/batches/blockchain/contracts and fronts
   *  payments + farmer-services + ai-platform for the coffee super-app hub. */
  "/api/v1/traceag-portal": {
    envKey: "UPSTREAM_TRACEAG_PORTAL",
    upstream: upstream("UPSTREAM_TRACEAG_PORTAL", "http://127.0.0.1:4020"),
    prefix: "/api/v1/traceag-portal",
    rewritePrefix: "/",
  },
  "/api/v1/warehouse": {
    envKey: "UPSTREAM_WAREHOUSE",
    upstream: upstream("UPSTREAM_WAREHOUSE", "http://127.0.0.1:4005"),
    prefix: "/api/v1/warehouse",
    rewritePrefix: "/",
  },
  "/api/v1/mes": {
    envKey: "UPSTREAM_MES",
    upstream: upstream("UPSTREAM_MES", "http://127.0.0.1:4003"),
    prefix: "/api/v1/mes",
    rewritePrefix: "/",
  },
  "/api/v1/erp": {
    envKey: "UPSTREAM_ERP",
    upstream: upstream("UPSTREAM_ERP", "http://127.0.0.1:4001"),
    prefix: "/api/v1/erp",
    rewritePrefix: "/",
  },
  "/api/v1/production": {
    envKey: "UPSTREAM_PRODUCTION",
    upstream: upstream("UPSTREAM_PRODUCTION", "http://127.0.0.1:4002"),
    prefix: "/api/v1/production",
    rewritePrefix: "/",
  },
  "/api/v1/quality-control": {
    envKey: "UPSTREAM_QUALITY_CONTROL",
    upstream: upstream("UPSTREAM_QUALITY_CONTROL", "http://127.0.0.1:4004"),
    prefix: "/api/v1/quality-control",
    rewritePrefix: "/",
  },
};

/** Routes whose upstream is unset in production and will fail on every request. */
export function unconfiguredUpstreams(): UpstreamRoute[] {
  return sortedUpstreamRoutes().filter((route) => isLoopbackUpstream(route.upstream));
}

/** Longest-prefix match for gateway paths (fleet IoT before fleet, etc.). */
export function matchUpstreamRoute(gatewayPath: string): UpstreamRoute | undefined {
  return routesByPrefixLength.find(
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

/**
 * Upstream routes sorted longest prefix first — use when registering proxies.
 *
 * Computed once. `upstreamRoutes` is resolved from the environment at module
 * load and never mutated afterwards, so re-sorting per call bought nothing —
 * and matchUpstreamRoute calls this, which isProxiedPath calls, which the auth
 * hook calls on every unmatched request.
 *
 * The returned array is frozen: callers get the shared instance now, so a
 * caller that sorted or spliced it in place would corrupt routing for every
 * subsequent request rather than just its own.
 */
const routesByPrefixLength: readonly UpstreamRoute[] = Object.freeze(
  Object.values(upstreamRoutes).sort((a, b) => b.prefix.length - a.prefix.length),
);

export function sortedUpstreamRoutes(): readonly UpstreamRoute[] {
  return routesByPrefixLength;
}

/** True when the path is proxied to a platform service (must have an explicit route policy). */
export function isProxiedPath(path: string): boolean {
  return matchUpstreamRoute(path) !== undefined;
}
