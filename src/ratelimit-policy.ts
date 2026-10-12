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

/** The limiter key: public-share requests count apart from everything else. */
export function rateLimitKey(rawUrl: string, ip: string): string {
  return bucketFor(rawUrl) === "public-share" ? `anon:${ip}` : ip;
}
