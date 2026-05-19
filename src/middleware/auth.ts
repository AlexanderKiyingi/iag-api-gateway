import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createAuthClient, isStaff, isSuperuser } from "@iag/auth-client";
import { matchPolicy } from "../policies.js";
import { isProxiedPath } from "../routes.js";

export interface GatewayAuthConfig {
  jwksUrl: string;
  issuer: string;
  gatewayInternalSecret?: string;
}

export const principalHeaders = {
  userId: "x-iag-user-id",
  email: "x-iag-email",
  groups: "x-iag-groups",
  roles: "x-iag-roles",
  permissions: "x-iag-permissions",
  isSuperuser: "x-iag-is-superuser",
  isStaff: "x-iag-is-staff",
  gatewaySecret: "x-iag-gateway-secret",
} as const;

export function registerAuthMiddleware(
  app: FastifyInstance,
  config: GatewayAuthConfig,
) {
  const auth = createAuthClient({
    jwksUrl: config.jwksUrl,
    issuer: config.issuer,
  });

  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    const path = request.url.split("?")[0] ?? request.url;
    const policy = matchPolicy(path, request.method);

    if (!policy) {
      if (isProxiedPath(path)) {
        return reply.status(403).send({
          error: "forbidden",
          reason: "no_route_policy",
        });
      }
      return;
    }

    if (policy.public) {
      return;
    }

    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "missing bearer token" });
    }

    const token = header.slice("Bearer ".length);
    let principal;
    try {
      principal = await auth.verifyAccessToken(token);
    } catch {
      return reply.status(401).send({ error: "invalid token" });
    }

    request.auth = principal;
    forwardPrincipalHeaders(request, principal, config.gatewayInternalSecret);

    if (
      policy.authenticated &&
      !policy.permissions?.length &&
      !policy.requireStaff &&
      !policy.requireAdmin
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
      return reply.status(403).send({
        error: "forbidden",
        required_permission: policy.permissions,
        require_staff: policy.requireStaff,
        require_admin: policy.requireAdmin,
      });
    }
  });
}

function forwardPrincipalHeaders(
  request: FastifyRequest,
  principal: NonNullable<FastifyRequest["auth"]>,
  gatewaySecret?: string,
) {
  request.headers[principalHeaders.userId] = principal.sub;
  if (principal.email) {
    request.headers[principalHeaders.email] = principal.email;
  }
  const groups = principal.groups?.length ? principal.groups : principal.roles;
  if (groups?.length) {
    request.headers[principalHeaders.groups] = groups.join(",");
    request.headers[principalHeaders.roles] = groups.join(",");
  }
  if (isSuperuser(principal)) {
    request.headers[principalHeaders.isSuperuser] = "true";
  }
  if (isStaff(principal)) {
    request.headers[principalHeaders.isStaff] = "true";
  }
  if (principal.permissions?.length) {
    request.headers[principalHeaders.permissions] = principal.permissions.join(",");
  }
  if (gatewaySecret) {
    request.headers[principalHeaders.gatewaySecret] = gatewaySecret;
  }
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: import("@iag/auth-client").VerifiedPrincipal;
  }
}
