import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import { baseEnvSchema, loadEnv } from "@iag/config";
import { createLogger, type Logger } from "@iag/observability";

export interface CreateServiceOptions {
  serviceName: string;
  port?: number;
  registerRoutes?: (app: FastifyInstance, logger: Logger) => Promise<void>;
}

export interface ServiceRuntime {
  app: FastifyInstance;
  logger: Logger;
  start: () => Promise<void>;
  stop: () => Promise<void>;
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

  const app = Fastify({ logger: false });

  app.get("/health", async () => ({
    status: "ok",
    service: env.SERVICE_NAME,
    timestamp: new Date().toISOString(),
  }));

  app.get("/ready", async () => ({
    status: "ready",
    service: env.SERVICE_NAME,
  }));

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
    async stop() {
      await app.close();
    },
  };
}
