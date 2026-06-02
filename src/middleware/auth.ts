import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createAuthClient } from "@iag/auth-client";
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

interface ErrorBody {
  error: {
    code: string;
    message: string;
  };
  reason?: string;
  required_permission?: string[];
  require_staff?: boolean;
  require_admin?: boolean;
}

function sendError(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
  extra?: Omit<ErrorBody, "error">,
) {
  return reply.status(status).send({
    error: { code, message },
    ...extra,
  });
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
      const path = request.url.split("?")[0] ?? request.url;
      const policy = matchPolicy(path, request.method);

      if (!policy) {
        if (isProxiedPath(path)) {
          return sendError(
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

      const header = request.headers.authorization;
      if (!header?.startsWith("Bearer ")) {
        return sendError(
          reply,
          401,
          "UNAUTHORIZED",
          "Missing bearer token",
        );
      }

      const token = header.slice("Bearer ".length);
      let principal;
      try {
        principal = await auth.verifyAccessToken(token);
      } catch {
        return sendError(
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
        let message = "Access denied for this route";
        if (policy.requireAdmin) {
          message = "Admin access required";
        } else if (policy.requireStaff) {
          message = "Staff access required";
        } else if (policy.permissions?.length) {
          message = `Missing required permission (need one of: ${policy.permissions.join(", ")})`;
        }
        return sendError(reply, 403, "FORBIDDEN", message, {
          required_permission: policy.permissions,
          require_staff: policy.requireStaff,
          require_admin: policy.requireAdmin,
        });
      }
    },
  );
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: import("@iag/auth-client").VerifiedPrincipal;
  }
}
