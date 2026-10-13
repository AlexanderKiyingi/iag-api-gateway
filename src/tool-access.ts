import { groupsFromClaims, type PrincipalClaims } from "@iag/auth-client";
import { normalizeApp } from "./usage.js";

/**
 * Per-tool access blocks.
 *
 * iag-authentication seeds a permissionless `no-access-<tool>` group per
 * frontend (domain/tool_access.go). A person in `no-access-fleet` is refused
 * on every request iag-fleet makes for them — identified by the X-IAG-App
 * header every frontend sends — while their other tools keep working.
 *
 * Superusers are exempt so the platform cannot be locked out of itself.
 * Requests without the header (direct API clients, service calls) are not
 * tool traffic and are left to the ordinary permission checks.
 */
export const TOOL_BLOCK_PREFIX = "no-access-";

export function toolBlockGroup(app: string): string {
  return TOOL_BLOCK_PREFIX + app.replace(/^iag-/, "");
}

/**
 * Whether the calling tool may use a route restricted to `apps` (RoutePolicy.apps).
 *
 * Unlike a block, a restricted route refuses a request with no header: the
 * point is that the action only happens from the named tools. Superusers stay
 * exempt, for the same reason as above and so an admin can still repair data
 * with a direct client.
 */
export function appAllowed(
  principal: PrincipalClaims,
  header: unknown,
  apps: readonly string[],
): boolean {
  if (principal.is_superuser) return true;
  const app = normalizeApp(header);
  return Boolean(app && apps.includes(app));
}

/** The blocked app's name when this principal may not use the calling tool, else null. */
export function blockedTool(principal: PrincipalClaims, header: unknown): string | null {
  const app = normalizeApp(header);
  if (!app) return null;
  if (principal.is_superuser) return null;
  const blocked = toolBlockGroup(app);
  return groupsFromClaims(principal).some((g) => g.trim().toLowerCase() === blocked) ? app : null;
}
