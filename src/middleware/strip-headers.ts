import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

/**
 * Reject any client request that includes one of the legacy X-IAG-* trust
 * headers. Pre-cutover, the gateway injected these after JWT verification and
 * backends trusted them via GATEWAY_INTERNAL_SECRET. Post-cutover, the gateway
 * forwards the original Bearer token and backends verify it directly — these
 * headers no longer carry meaning and accepting them would re-open the trust
 * vector.
 */
const FORBIDDEN_CLIENT_HEADERS = [
  "x-iag-user-id",
  "x-iag-email",
  "x-iag-groups",
  "x-iag-roles",
  "x-iag-permissions",
  "x-iag-is-superuser",
  "x-iag-is-staff",
  "x-iag-gateway-secret",
] as const;

export function registerStripTrustHeaders(app: FastifyInstance) {
  app.addHook(
    "onRequest",
    async (request: FastifyRequest, reply: FastifyReply) => {
      for (const name of FORBIDDEN_CLIENT_HEADERS) {
        if (request.headers[name] !== undefined) {
          return reply.status(400).send({
            error: "bad_request",
            reason: `header ${name} is not permitted; the gateway no longer trusts client-supplied principal headers`,
          });
        }
      }
    },
  );
}
