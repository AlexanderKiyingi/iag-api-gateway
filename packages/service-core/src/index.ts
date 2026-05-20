import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import { baseEnvSchema, loadEnv } from "@iag/config";
import { createLogger, type Logger } from "@iag/observability";

export interface ReadyCheckResult {
  status: "ready" | "degraded" | "not_ready";
  checks?: Record<string, { ok: boolean; detail?: string }>;
}

export interface CreateServiceOptions {
  serviceName: string;
  port?: number;
  trustProxy?: boolean;
  registerRoutes?: (app: FastifyInstance, logger: Logger) => Promise<void>;
  readyCheck?: () => Promise<ReadyCheckResult>;
}

export interface ServiceRuntime {
  app: FastifyInstance;
  logger: Logger;
  start: () => Promise<void>;
  stop: (timeoutMs?: number) => Promise<void>;
}

export async function createService(
  options: CreateServiceOptions,
): Promise<ServiceRuntime> {
  const env = loadEnv(
    baseEnvSchema.extend({
      SERVICE_NAME: z.string().default(options.serviceName),
      PORT: z.coerce.number().int().positive().default(options.port ?? 3000),
    }),
  );

  const logger = createLogger({
    serviceName: env.SERVICE_NAME,
    level: env.LOG_LEVEL,
  });

  const app = Fastify({
    logger: false,
    trustProxy: options.trustProxy ?? false,
  });

  app.get("/health", async () => ({
    status: "ok",
    service: env.SERVICE_NAME,
    timestamp: new Date().toISOString(),
  }));

  app.get("/ready", async (_request, reply) => {
    if (!options.readyCheck) {
      return {
        status: "ready",
        service: env.SERVICE_NAME,
      };
    }
    const result = await options.readyCheck();
    const code =
      result.status === "ready"
        ? 200
        : result.status === "degraded"
          ? 200
          : 503;
    reply.code(code);
    return {
      status: result.status,
      service: env.SERVICE_NAME,
      checks: result.checks,
    };
  });

  if (options.registerRoutes) {
    await options.registerRoutes(app, logger);
  }

  return {
    app,
    logger,
    async start() {
      await app.listen({ port: env.PORT, host: "0.0.0.0" });
      logger.info({ port: env.PORT }, "service listening");
    },
    async stop(timeoutMs = 30_000) {
      const closePromise = app.close();
      await Promise.race([
        closePromise,
        new Promise<void>((_, reject) => {
          setTimeout(
            () => reject(new Error(`shutdown timed out after ${timeoutMs}ms`)),
            timeoutMs,
          );
        }),
      ]);
    },
  };
}
