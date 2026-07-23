import rateLimit from "@fastify/rate-limit";
import httpProxy from "@fastify/http-proxy";
import { createService } from "@iag/service-core";
import { loadGatewayEnv } from "./config.js";
import {
  createProxyOnError,
  registerGatewayErrorHandler,
} from "./errors.js";
import { initOTel, shutdownOTel } from "./otel.js";
import { registerAuthMiddleware } from "./middleware/auth.js";
import { registerCORS } from "./middleware/cors.js";
import { registerRequestId } from "./middleware/request-id.js";
import { registerSecurityHeaders } from "./middleware/security-headers.js";
import { registerStripTrustHeaders } from "./middleware/strip-headers.js";
import { createReadyCheck } from "./ready.js";
import { sortedUpstreamRoutes, upstreamRoutes } from "./routes.js";

const env = loadGatewayEnv();
const SHUTDOWN_TIMEOUT_MS = 30_000;
const exposeErrorDetail = env.NODE_ENV !== "production";

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
  maxHeaderSize: env.MAX_HEADER_SIZE,
  readyCheck: createReadyCheck(env.READY_PROBE_UPSTREAMS),
  async registerRoutes(app, logger) {
    registerGatewayErrorHandler(app, { exposeDetail: exposeErrorDetail });
    await registerCORS(app, env);
    registerSecurityHeaders(app);
    registerStripTrustHeaders(app);
    registerRequestId(app);

    // Per-window ceiling by route class. `request.ip` is only a real, per-client
    // key when TRUST_PROXY is set to the edge hop count (see config.ts); with the
    // default it is the edge IP and the limiter is effectively one global bucket.
    // NOTE: the store is @fastify/rate-limit's in-memory default — correct for a
    // single gateway instance; a horizontally-scaled gateway needs a shared
    // (Redis) store, which requires adding an ioredis dependency.
    const OAUTH_TOKEN_PATH = "/api/v1/authentication/oauth/token";
    const SENSITIVE_AUTH_PATHS = [
      "/api/v1/authentication/v1/auth/forgot-password",
      "/api/v1/authentication/v1/auth/reset-password",
      "/api/v1/authentication/oauth/revoke",
      "/api/v1/authentication/v1/service/provision-user",
      "/api/v1/authentication/v1/tokens",
      "/api/v1/authentication/v1/share-tokens",
    ];
    await app.register(rateLimit, {
      global: true,
      timeWindow: env.RATE_LIMIT_WINDOW_MS,
      keyGenerator: (request) => request.ip,
      max: (request, _key) => {
        const path = request.url.split("?")[0] ?? "";
        if (path.includes(OAUTH_TOKEN_PATH)) return env.OAUTH_RATE_LIMIT_MAX;
        if (SENSITIVE_AUTH_PATHS.some((p) => path.includes(p))) {
          return env.SENSITIVE_RATE_LIMIT_MAX;
        }
        return env.RATE_LIMIT_MAX;
      },
    });

    registerAuthMiddleware(app, {
      jwksUrl: env.JWKS_URL,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });

    for (const config of sortedUpstreamRoutes()) {
      await app.register(httpProxy, {
        upstream: config.upstream,
        prefix: config.prefix,
        rewritePrefix: config.rewritePrefix,
        // Proxy WebSocket upgrades for upstreams that opt in (e.g. the
        // contract-management workspace socket at /v1/ws/workspace).
        websocket: config.websocket ?? false,
        replyOptions: {
          onError: createProxyOnError(config.prefix, {
            exposeDetail: exposeErrorDetail,
          }),
        },
      });
      logger.info({ prefix: config.prefix, upstream: config.upstream }, "registered upstream");

      // Loopback upstream in production almost always means an unset/wrong
      // UPSTREAM_* var (routes.ts falls back to 127.0.0.1:<port>). Left as-is
      // it surfaces later as a mystery 503 UPSTREAM_ERROR at request time, so
      // flag it loudly at boot where the deploy logs make it obvious.
      if (env.NODE_ENV === "production") {
        let host = "";
        try {
          host = new URL(config.upstream).hostname;
        } catch {
          host = "";
        }
        if (host === "127.0.0.1" || host === "localhost" || host === "::1") {
          logger.warn(
            { prefix: config.prefix, upstream: config.upstream },
            "upstream resolves to loopback in production — UPSTREAM_* env var is unset or wrong; requests to this prefix will 503",
          );
        }
      }
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
