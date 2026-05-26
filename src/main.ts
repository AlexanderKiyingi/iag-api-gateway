import rateLimit from "@fastify/rate-limit";
import httpProxy from "@fastify/http-proxy";
import { createService } from "@iag/service-core";
import { loadGatewayEnv } from "./config.js";
import { initOTel, shutdownOTel } from "./otel.js";
import { registerAuthMiddleware } from "./middleware/auth.js";
import { registerRequestId } from "./middleware/request-id.js";
import { registerStripTrustHeaders } from "./middleware/strip-headers.js";
import { createReadyCheck } from "./ready.js";
import { upstreamRoutes } from "./routes.js";

const env = loadGatewayEnv();
const SHUTDOWN_TIMEOUT_MS = 30_000;

// Initialise OTel BEFORE any HTTP client/server is constructed, so the
// auto-instrumentation hooks pick up fetch and http.
await initOTel({
  serviceName: env.SERVICE_NAME,
  endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
  environment: env.NODE_ENV,
});

const service = await createService({
  serviceName: "api-gateway",
  port: env.PORT,
  trustProxy: env.TRUST_PROXY,
  readyCheck: createReadyCheck(env.READY_PROBE_UPSTREAMS),
  async registerRoutes(app, logger) {
    registerStripTrustHeaders(app);
    registerRequestId(app);

    await app.register(rateLimit, {
      global: true,
      timeWindow: env.RATE_LIMIT_WINDOW_MS,
      keyGenerator: (request) => request.ip,
      max: (request, _key) =>
        (request.url.split("?")[0] ?? "").includes(
          "/api/v1/authentication/oauth/token",
        )
          ? env.OAUTH_RATE_LIMIT_MAX
          : env.RATE_LIMIT_MAX,
    });

    registerAuthMiddleware(app, {
      jwksUrl: env.JWKS_URL,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });

    for (const [prefix, config] of Object.entries(upstreamRoutes)) {
      await app.register(httpProxy, {
        upstream: config.upstream,
        prefix: config.prefix,
        rewritePrefix: config.rewritePrefix,
      });
      logger.info({ prefix, upstream: config.upstream }, "registered upstream");
    }

    app.get("/api/v1", async () => ({
      platform: "IAG",
      routes: Object.keys(upstreamRoutes),
    }));
  },
});

await service.start();

async function shutdown(signal: string) {
  service.logger.info({ signal }, "shutting down");
  try {
    await service.stop(SHUTDOWN_TIMEOUT_MS);
    await shutdownOTel();
    process.exit(0);
  } catch (err) {
    service.logger.error({ err }, "shutdown failed");
    process.exit(1);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
