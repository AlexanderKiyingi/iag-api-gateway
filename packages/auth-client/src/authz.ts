/** Django-aligned authorization helpers */

export const GROUP_SUPERADMIN = "superadmin";
export const GROUP_ADMIN = "admin";
export const GROUP_STAFF = "staff";
export const GROUP_USER = "user";

export interface PrincipalClaims {
  sub?: string;
  email?: string;
  is_superuser?: boolean;
  is_staff?: boolean;
  groups?: string[];
  roles?: string[];
  permissions?: string[];
}

export function groupsFromClaims(claims: PrincipalClaims): string[] {
  if (claims.groups?.length) return claims.groups;
  return claims.roles ?? [];
}

export function isSuperuser(claims: PrincipalClaims): boolean {
  if (claims.is_superuser) return true;
  return groupsFromClaims(claims).includes(GROUP_SUPERADMIN);
}

export function isStaff(claims: PrincipalClaims): boolean {
  if (isSuperuser(claims)) return true;
  if (claims.is_staff) return true;
  const groups = groupsFromClaims(claims);
  return groups.includes(GROUP_ADMIN) || groups.includes(GROUP_STAFF);
}

export function hasPermission(claims: PrincipalClaims, codename: string): boolean {
  if (isSuperuser(claims)) return true;
  return (claims.permissions ?? []).includes(codename);
}

export function hasAnyPermission(
  claims: PrincipalClaims,
  required: string[] = [],
): boolean {
  if (isSuperuser(claims)) return true;
  if (required.length === 0) return true;
  const perms = claims.permissions ?? [];
  return required.some((p) => perms.includes(p));
}

export function hasAllPermissions(
  claims: PrincipalClaims,
  required: string[] = [],
): boolean {
  if (isSuperuser(claims)) return true;
  const perms = claims.permissions ?? [];
  return required.every((p) => perms.includes(p));
}

export function canAccessDjangoAdmin(
  claims: PrincipalClaims,
  adminPerms: string[] = ["auth.change_user", "auth.change_group"],
): boolean {
  if (isSuperuser(claims)) return true;
  if (!isStaff(claims)) return false;
  if (groupsFromClaims(claims).includes(GROUP_ADMIN)) return true;
  return hasAnyPermission(claims, adminPerms);
}

export function claimsFromPayload(payload: Record<string, unknown>): PrincipalClaims {
  return {
    sub: typeof payload.sub === "string" ? payload.sub : undefined,
    email: typeof payload.email === "string" ? payload.email : undefined,
    is_superuser: payload.is_superuser === true,
    is_staff: payload.is_staff === true,
    groups: Array.isArray(payload.groups)
      ? payload.groups.filter((g): g is string => typeof g === "string")
      : undefined,
    roles: Array.isArray(payload.roles)
      ? payload.roles.filter((r): r is string => typeof r === "string")
      : undefined,
    permissions: Array.isArray(payload.permissions)
      ? payload.permissions.filter((p): p is string => typeof p === "string")
      : undefined,
  };
}
