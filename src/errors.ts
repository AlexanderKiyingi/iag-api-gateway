import type {
  FastifyError,
  FastifyReply,
  FastifyRequest,
  RawServerBase,
  RouteGenericInterface,
} from "fastify";

export interface GatewayErrorBody {
  error: {
    code: string;
    message: string;
  };
  upstream?: string;
  detail?: string;
  reason?: string;
  required_permission?: string[];
  require_staff?: boolean;
  require_admin?: boolean;
}

export function sendGatewayError(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
  extra?: Omit<GatewayErrorBody, "error">,
) {
  if (reply.sent) {
    return reply;
  }
  return reply.status(status).send({
    error: { code, message },
    ...extra,
  });
}

const CONNECTION_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
]);

export function isUpstreamConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const err = error as { code?: string; cause?: unknown };
  if (err.code && CONNECTION_ERROR_CODES.has(err.code)) {
    return true;
  }
  if (err.cause) {
    return isUpstreamConnectionError(err.cause);
  }
  return false;
}

export function upstreamUnavailableMessage(upstreamPrefix: string): string {
  switch (upstreamPrefix) {
    case "/api/v1/authentication":
      return "Authentication service is unavailable";
    case "/api/v1/notifications":
      return "Notifications service is unavailable";
    case "/api/v1/users":
      return "Users service is unavailable";
    case "/api/v1/finance":
    case "/api/v1/accounts":
      return "Finance service is unavailable";
    default:
      return `Upstream service is unavailable (${upstreamPrefix})`;
  }
}

export function createProxyOnError(
  upstreamPrefix: string,
  options: { exposeDetail?: boolean } = {},
) {
  return (
    reply: FastifyReply<RouteGenericInterface, RawServerBase>,
    error: { error: Error },
  ) => {
    if (reply.sent) {
      return;
    }

    const err = error.error;
    reply.log.error(
      { err, upstream: upstreamPrefix },
      "upstream proxy error",
    );

    const status = isUpstreamConnectionError(err) ? 502 : 503;
    const code = status === 502 ? "BAD_GATEWAY" : "UPSTREAM_ERROR";
    const body: GatewayErrorBody = {
      error: {
        code,
        message: upstreamUnavailableMessage(upstreamPrefix),
      },
      upstream: upstreamPrefix,
    };

    if (options.exposeDetail && err.message) {
      body.detail = err.message;
    }

    void reply.status(status).send(body);
  };
}

export function registerGatewayErrorHandler(
  app: import("fastify").FastifyInstance,
  options: { exposeDetail?: boolean } = {},
) {
  app.setErrorHandler(
    (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
      if (reply.sent) {
        return;
      }

      request.log.error({ err: error }, "unhandled gateway error");

      const status =
        typeof error.statusCode === "number" && error.statusCode >= 400
          ? error.statusCode
          : 500;
      const code =
        typeof error.code === "string" && error.code.length > 0
          ? error.code
          : status === 502
            ? "BAD_GATEWAY"
            : "INTERNAL_ERROR";

      const body: GatewayErrorBody = {
        error: {
          code,
          message:
            status >= 500
              ? "Gateway request failed"
              : error.message || "Request failed",
        },
      };

      if (options.exposeDetail && error.message) {
        body.detail = error.message;
      }

      void reply.status(status).send(body);
    },
  );
}
