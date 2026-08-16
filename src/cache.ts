import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

/**
 * Gateway response caching.
 *
 * Users are in East Africa and the platform runs in a distant Railway region,
 * so a round trip costs on the order of 150–280ms while the server work behind
 * it costs single-digit milliseconds. That ratio makes "don't make the request
 * at all" worth far more than "make the request faster", and a freshness
 * lifetime is the only thing that achieves it — an ETag still costs the full
 * round trip to be told nothing changed.
 *
 * Everything here is authenticated, so responses are marked `private` and vary
 * on Authorization. A shared cache must never be able to hand one user's data
 * to another.
 */

export interface CachePolicy {
  /** Path prefix, matched against the gateway path (longest prefix wins). */
  prefix: string;
  /** Browser freshness lifetime in seconds. */
  maxAgeSeconds: number;
}

/**
 * Endpoints safe to serve from the browser cache for a bounded window.
 *
 * Deliberately empty. Populating it is a per-endpoint judgement about staleness
 * that needs the requests-per-page census to be worth anything, and a wrong
 * entry means a user acting on stale financial data — the failure mode is
 * silent and the blast radius is the business, not the page.
 *
 * Rules for adding an entry:
 *   - Reference data only: charts of accounts, vendor lists, user directories,
 *     permission sets. Things that change on an admin's timescale, not a
 *     transaction's.
 *   - Never cache a read that feeds a write decision. An approval screen
 *     showing a stale balance is worse than a slow approval screen.
 *   - Keep lifetimes short (60–300s). The win is collapsing a burst of repeat
 *     navigation, not long-term storage.
 *   - Anything transactional waits for event-driven invalidation.
 *
 * Example once the census identifies a target:
 *   { prefix: "/api/v1/finance/v1/chart-of-accounts", maxAgeSeconds: 120 }
 */
export const CACHE_POLICIES: CachePolicy[] = [];

/**
 * Paths whose responses must never be stored, independent of what the upstream
 * says. Token and credential responses are the ones that actually matter: a
 * cached token response on a shared machine is a session handed to the next
 * person to use the browser.
 */
export const NO_STORE_PREFIXES: string[] = [
  "/api/v1/authentication/oauth/token",
  "/api/v1/authentication/oauth/revoke",
  "/api/v1/authentication/oauth/external",
  "/api/v1/authentication/v1/auth/forgot-password",
  "/api/v1/authentication/v1/auth/reset-password",
  "/api/v1/authentication/v1/tokens",
  "/api/v1/authentication/v1/share-tokens",
];

/** Longest-prefix match, so a specific policy beats a general one. */
export function matchCachePolicy(
  path: string,
  policies: CachePolicy[] = CACHE_POLICIES,
): CachePolicy | undefined {
  let best: CachePolicy | undefined;
  for (const policy of policies) {
    if (path === policy.prefix || path.startsWith(`${policy.prefix}/`)) {
      if (!best || policy.prefix.length > best.prefix.length) {
        best = policy;
      }
    }
  }
  return best;
}

export function isNoStorePath(
  path: string,
  prefixes: string[] = NO_STORE_PREFIXES,
): boolean {
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Decide the Cache-Control value for one response, or undefined to leave the
 * upstream's own headers untouched.
 *
 * Exported separately from the hook so the decision is testable without
 * standing up a proxy.
 */
export function cacheControlFor(args: {
  method: string;
  path: string;
  statusCode: number;
  upstreamCacheControl?: string;
  policies?: CachePolicy[];
}): string | undefined {
  const { method, path, statusCode, upstreamCacheControl } = args;

  if (isNoStorePath(path)) {
    return "no-store";
  }

  // Only safe methods are cacheable, and only a plain success. A 206, 3xx or
  // error carries different caching rules that aren't worth inferring here.
  if (method !== "GET" && method !== "HEAD") return undefined;
  if (statusCode !== 200) return undefined;

  // An upstream that stated its own intent knows more than this table does.
  if (upstreamCacheControl && upstreamCacheControl.trim() !== "") {
    return undefined;
  }

  const policy = matchCachePolicy(path, args.policies);
  if (!policy) return undefined;

  return `private, max-age=${policy.maxAgeSeconds}, must-revalidate`;
}

/**
 * Register the cache-header hook. Must be registered before the proxies so the
 * onSend hook is in scope for proxied replies.
 */
export function registerCacheHeaders(
  app: FastifyInstance,
  policies: CachePolicy[] = CACHE_POLICIES,
): void {
  app.addHook("onSend", async (request: FastifyRequest, reply: FastifyReply, payload) => {
    const path = request.url.split("?")[0] ?? "";
    const existing = reply.getHeader("cache-control");

    const value = cacheControlFor({
      method: request.method,
      path,
      statusCode: reply.statusCode,
      upstreamCacheControl: typeof existing === "string" ? existing : undefined,
      policies,
    });

    if (value) {
      reply.header("Cache-Control", value);
      if (value !== "no-store") {
        // Belt and braces alongside `private`: if any intermediary does store
        // this, it must not serve it across users.
        reply.header("Vary", appendVary(reply.getHeader("vary"), "Authorization"));
      }
    }
    return payload;
  });
}

/** Append a field to an existing Vary header without duplicating it. */
export function appendVary(
  existing: string | number | string[] | undefined,
  field: string,
): string {
  const current = Array.isArray(existing)
    ? existing.join(", ")
    : typeof existing === "string"
      ? existing
      : "";
  if (current.trim() === "") return field;
  const parts = current.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.some((p) => p.toLowerCase() === field.toLowerCase())) return current;
  return [...parts, field].join(", ");
}
