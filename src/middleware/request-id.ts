import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export const REQUEST_ID_HEADER = "x-request-id";
export const CORRELATION_ID_HEADER = "x-correlation-id";

export function registerRequestId(app: FastifyInstance) {
  app.addHook(
    "onRequest",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const incoming =
        headerValue(request.headers[REQUEST_ID_HEADER]) ??
        headerValue(request.headers[CORRELATION_ID_HEADER]);
      const requestId = incoming ?? randomUUID();
      request.requestId = requestId;
      reply.header(REQUEST_ID_HEADER, requestId);
      reply.header(CORRELATION_ID_HEADER, requestId);
    },
  );
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value) && value[0]?.trim()) return value[0].trim();
  return undefined;
}

declare module "fastify" {
  interface FastifyRequest {
    requestId?: string;
  }
}
