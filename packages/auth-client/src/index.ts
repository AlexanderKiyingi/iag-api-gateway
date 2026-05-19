import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import {
  canAccessDjangoAdmin,
  claimsFromPayload,
  hasAllPermissions,
  hasAnyPermission,
  isStaff,
  isSuperuser,
  type PrincipalClaims,
} from "./authz.js";

export {
  canAccessDjangoAdmin,
  claimsFromPayload,
  GROUP_ADMIN,
  GROUP_STAFF,
  GROUP_SUPERADMIN,
  GROUP_USER,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  isStaff,
  isSuperuser,
} from "./authz.js";
export type { PrincipalClaims };

export interface AuthClientOptions {
  jwksUrl: string;
  issuer: string;
  audience?: string | string[];
}

export interface VerifiedPrincipal extends JWTPayload, PrincipalClaims {
  sub: string;
}

export function createAuthClient(options: AuthClientOptions) {
  const jwks = createRemoteJWKSet(new URL(options.jwksUrl));

  async function verifyAccessToken(token: string): Promise<VerifiedPrincipal> {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: options.issuer,
      audience: options.audience,
    });

    if (typeof payload.sub !== "string") {
      throw new Error("Token missing subject (sub)");
    }

    const claims = claimsFromPayload(payload as Record<string, unknown>);
    return { ...payload, ...claims, sub: payload.sub as string } as VerifiedPrincipal;
  }

  function authorize(
    principal: PrincipalClaims,
    options: {
      permissions?: string[];
      all?: boolean;
      requireStaff?: boolean;
      requireAdmin?: boolean;
    } = {},
  ): boolean {
    if (options.requireAdmin && !canAccessDjangoAdmin(principal)) {
      return false;
    }
    if (options.requireStaff && !isStaff(principal)) {
      return false;
    }
    const { permissions = [], all = false } = options;
    if (permissions.length === 0) return true;
    return all
      ? hasAllPermissions(principal, permissions)
      : hasAnyPermission(principal, permissions);
  }

  return { verifyAccessToken, authorize, isSuperuser, isStaff, hasAnyPermission };
}

export type AuthClient = ReturnType<typeof createAuthClient>;
