import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  createAuthClient,
  GROUP_ADMIN,
  groupsFromClaims,
  hasAnyPermission,
  isStaff,
  type PrincipalClaims,
} from "@iag/auth-client";
import { sendGatewayError } from "../errors.js";
import { matchPolicy } from "../policies.js";
import { isProxiedPath } from "../routes.js";

export interface GatewayAuthConfig {
  jwksUrl: string;
  issuer: string;
  /** Required after the hard cutover. The gateway accepts only tokens whose
   *  audience array contains this value (default "iag.gateway"). Backends each
   *  verify their own audience separately. */
  audience: string | string[];
}

export function registerAuthMiddleware(
  app: FastifyInstance,
  config: GatewayAuthConfig,
) {
  const auth = createAuthClient({
    jwksUrl: config.jwksUrl,
    issuer: config.issuer,
    audience: config.audience,
  });

  app.addHook(
    "onRequest",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await enforceAuthPolicy(request, reply, auth);
      } catch (err) {
        request.log.error({ err }, "auth middleware failed");
        sendGatewayError(
          reply,
          500,
          "INTERNAL_ERROR",
          "Authentication check failed",
        );
      }
    },
  );
}

async function enforceAuthPolicy(
  request: FastifyRequest,
  reply: FastifyReply,
  auth: ReturnType<typeof createAuthClient>,
) {
  const path = request.url.split("?")[0] ?? request.url;
  const policy = matchPolicy(path, request.method);

  if (!policy) {
    if (isProxiedPath(path)) {
      return sendGatewayError(
        reply,
        403,
        "FORBIDDEN",
        "No route policy matches this path",
        { reason: "no_route_policy" },
      );
    }
    return;
  }

  if (policy.public) {
    return;
  }

  let token: string | undefined;
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    token = header.slice("Bearer ".length);
  } else if (
    request.headers.upgrade?.toLowerCase() === "websocket" &&
    path.includes("/api/v1/project-management/api/v1/ws/")
  ) {
    const q = request.url.includes("?") ? request.url.split("?")[1] : "";
    const fromQuery = new URLSearchParams(q).get("token");
    if (fromQuery) {
      token = fromQuery;
      request.headers.authorization = `Bearer ${fromQuery}`;
    }
  }

  if (!token) {
    return sendGatewayError(
      reply,
      401,
      "UNAUTHORIZED",
      "Missing bearer token",
    );
  }
  let principal;
  try {
    principal = await auth.verifyAccessToken(token);
  } catch {
    return sendGatewayError(
      reply,
      401,
      "UNAUTHORIZED",
      "Invalid or expired token",
    );
  }

  // Stash the verified principal for downstream observability hooks.
  // The gateway no longer injects X-IAG-* trust headers — backends verify
  // the same Authorization header against their own audience.
  request.auth = principal;

  // Propagate the correlation id so upstream services join the same trace.
  if (request.requestId) {
    request.headers["x-request-id"] = request.requestId;
    request.headers["x-correlation-id"] = request.requestId;
  }

  if (policy.requireAllPermissions?.length) {
    if (
      !auth.authorize(principal, {
        permissions: policy.requireAllPermissions,
        all: true,
      })
    ) {
      return sendGatewayError(
        reply,
        403,
        "FORBIDDEN",
        `Missing required permission (need all of: ${policy.requireAllPermissions.join(", ")})`,
        { required_all_permissions: policy.requireAllPermissions },
      );
    }
  }

  if (
    policy.authenticated &&
    !policy.permissions?.length &&
    !policy.requireStaff &&
    !policy.requireAdmin
  ) {
    return;
  }

  if (
    policy.fleetPlatformAdminRead &&
    canFleetPlatformAdminRead(principal, policy.permissions)
  ) {
    return;
  }

  if (
    !auth.authorize(principal, {
      permissions: policy.permissions,
      requireStaff: policy.requireStaff,
      requireAdmin: policy.requireAdmin,
    })
  ) {
    let message = "Access denied for this route";
    if (policy.requireAdmin) {
      message = "Admin access required";
    } else if (policy.requireStaff) {
      message = "Staff access required";
    } else if (policy.permissions?.length) {
      message = `Missing required permission (need one of: ${policy.permissions.join(", ")})`;
    }
    return sendGatewayError(reply, 403, "FORBIDDEN", message, {
      required_permission: policy.permissions,
      require_staff: policy.requireStaff,
      require_admin: policy.requireAdmin,
    });
  }
}

function canFleetPlatformAdminRead(
  principal: PrincipalClaims,
  required: string[] | undefined,
): boolean {
  if (!required?.length) {
    return false;
  }
  if (hasAnyPermission(principal, required)) {
    return true;
  }
  return isStaff(principal) && groupsFromClaims(principal).includes(GROUP_ADMIN);
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: import("@iag/auth-client").VerifiedPrincipal;
  }
}
