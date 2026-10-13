/**
 * Which rate-limit budget a request draws on.
 *
 * Links that work without signing in — traceability QR pages, project
 * shares, buyer quality links — are the routes anyone on the internet can
 * hit, and the ones a scraper would. They get their own, tighter budget keyed
 * separately ("anon:" + IP), so scraping them cannot exhaust the budget the
 * same address uses for signed-in work, and signed-in traffic cannot be
 * starved by it either.
 */

export const OAUTH_TOKEN_PATH = "/api/v1/authentication/oauth/token";

export const SENSITIVE_AUTH_PATHS = [
  "/api/v1/authentication/v1/auth/forgot-password",
  "/api/v1/authentication/v1/auth/reset-password",
  "/api/v1/authentication/oauth/revoke",
  "/api/v1/authentication/v1/service/provision-user",
  "/api/v1/authentication/v1/tokens",
  "/api/v1/authentication/v1/share-tokens",
];

/** Public share surfaces: no sign-in, a URL as the credential. */
export const PUBLIC_SHARE_PREFIXES = [
  "/api/v1/traceability/public",
  "/api/v1/supply-chain/public",
  "/api/v1/project-management/shared",
  "/api/v1/project-management/public/forms",
  "/api/v1/quality-control/public",
];

export type Bucket = "public-share" | "oauth" | "sensitive" | "default";

export function bucketFor(rawUrl: string): Bucket {
  const path = rawUrl.split("?")[0] ?? "";
  if (path.includes(OAUTH_TOKEN_PATH)) return "oauth";
  if (SENSITIVE_AUTH_PATHS.some((p) => path.includes(p))) return "sensitive";
  if (PUBLIC_SHARE_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) return "public-share";
  return "default";
}

/**
 * The per-user budget's key, from the verified token.
 *
 * The per-IP limiter runs before the token is checked, so it can only see the
 * connecting address — and a frontend that calls the gateway from its own
 * server (iag-security, the finance clones) makes every one of its users look
 * like one client. Keyed on the verified subject instead, each person gets a
 * budget of their own; service accounts are keyed by client so a busy
 * integration cannot spend a human's budget.
 */
export function principalRateLimitKey(principal: {
  sub?: string;
  client_id?: unknown;
  principal_type?: unknown;
}): string {
  if (principal.principal_type === "service") {
    const client = typeof principal.client_id === "string" && principal.client_id ? principal.client_id : principal.sub;
    return `svc:${client ?? "unknown"}`;
  }
  return `user:${principal.sub ?? "unknown"}`;
}

/** The limiter key: public-share requests count apart from everything else. */
export function rateLimitKey(rawUrl: string, ip: string): string {
  return bucketFor(rawUrl) === "public-share" ? `anon:${ip}` : ip;
}
