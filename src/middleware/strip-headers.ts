import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { principalHeaders } from "./auth.js";

/** Headers clients must not send — gateway sets these after JWT verification. */
const STRIP_HEADERS = [
  principalHeaders.userId,
  principalHeaders.email,
  principalHeaders.groups,
  principalHeaders.roles,
  principalHeaders.permissions,
  principalHeaders.isSuperuser,
  principalHeaders.isStaff,
  principalHeaders.gatewaySecret,
] as const;

export function registerStripTrustHeaders(app: FastifyInstance) {
  app.addHook(
    "onRequest",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      for (const name of STRIP_HEADERS) {
        delete request.headers[name];
      }
    },
  );
}
