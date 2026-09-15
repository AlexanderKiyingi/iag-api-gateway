import rateLimit from "@fastify/rate-limit";
import httpProxy from "@fastify/http-proxy";
import type { FastifyReply } from "fastify";
import { createService } from "@iag/service-core";
import { loadGatewayEnv } from "./config.js";
import {
  createProxyOnError,
  registerGatewayErrorHandler,
  unconfiguredUpstreamBody,
} from "./errors.js";
import { initOTel, shutdownOTel } from "./otel.js";
import { registerAuthMiddleware } from "./middleware/auth.js";
import { registerCORS } from "./middleware/cors.js";
import { registerRequestId } from "./middleware/request-id.js";
import { registerSecurityHeaders } from "./middleware/security-headers.js";
import { registerStripTrustHeaders } from "./middleware/strip-headers.js";
import { createReadyCheck } from "./ready.js";
import { registerCacheHeaders } from "./cache.js";
import { createRateLimitStore, rateLimitBootMessage } from "./ratelimit-store.js";
import { registerApprovalsDesk } from "./approvals-desk.js";
import {
  isLoopbackUpstream,
  sortedUpstreamRoutes,
  unconfiguredUpstreams,
  upstreamRoutes,
} from "./routes.js";

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

// See the TRUST_PROXY note in config.ts for why unset means one hop here.
const PRODUCTION_EDGE_HOPS = 1;
const trustProxy =
  env.TRUST_PROXY ?? (env.NODE_ENV === "production" ? PRODUCTION_EDGE_HOPS : false);

const service = await createService({
  serviceName: "api-gateway",
  port: env.PORT,
  trustProxy,
  maxHeaderSize: env.MAX_HEADER_SIZE,
  readyCheck: createReadyCheck(env.READY_PROBE_UPSTREAMS),
  async registerRoutes(app, logger) {
    registerGatewayErrorHandler(app, { exposeDetail: exposeErrorDetail });
    await registerCORS(app, env);
    registerSecurityHeaders(app);
    registerStripTrustHeaders(app);
    registerRequestId(app);
    // Before the proxies, so the onSend hook is in scope for proxied replies.
    registerCacheHeaders(app);

    // Per-window ceiling by route class. `request.ip` is only a real, per-client
    // key when TRUST_PROXY is set to the edge hop count (see config.ts); with the
    // default it is the edge IP and the limiter is effectively one global bucket.
    // The store is Redis-backed when REDIS_URL is set and in-process otherwise;
    // only the former is correct for more than one gateway instance.
    const OAUTH_TOKEN_PATH = "/api/v1/authentication/oauth/token";
    const SENSITIVE_AUTH_PATHS = [
      "/api/v1/authentication/v1/auth/forgot-password",
      "/api/v1/authentication/v1/auth/reset-password",
      "/api/v1/authentication/oauth/revoke",
      "/api/v1/authentication/v1/service/provision-user",
      "/api/v1/authentication/v1/tokens",
      "/api/v1/authentication/v1/share-tokens",
    ];
    // TRUST_PROXY decides whether the limiter's per-IP key is real. Both wrong
    // values fail quietly, in opposite directions, so say so at boot where the
    // deploy log makes it obvious rather than leaving it to be discovered as
    // either an outage or a bypass.
    if (env.NODE_ENV === "production") {
      if (trustProxy === true) {
        logger.warn(
          "TRUST_PROXY=true trusts a client-supplied X-Forwarded-For, so any caller can forge their rate-limit key and their logged IP — set it to the edge hop count (usually 1) instead",
        );
      } else if (trustProxy === false) {
        logger.warn(
          "TRUST_PROXY=false behind an edge makes request.ip the edge address — every client shares one rate-limit bucket; set it to the edge hop count (usually 1)",
        );
      } else if (env.TRUST_PROXY === undefined) {
        logger.info(
          `TRUST_PROXY unset — trusting ${PRODUCTION_EDGE_HOPS} edge hop so rate limits key on the real client IP; set TRUST_PROXY explicitly if the gateway sits behind a different topology`,
        );
      }
    }

    // One budget across replicas when Redis is configured, this process's own
    // when it is not. See ratelimit-store.ts for why an absent or broken Redis
    // must not stop the gateway answering.
    const rateLimitStore = createRateLimitStore(env.REDIS_URL, logger);
    const rateLimitBoot = rateLimitBootMessage(
      rateLimitStore,
      env.NODE_ENV === "production",
    );
    logger[rateLimitBoot.level](rateLimitBoot.message);

    await app.register(rateLimit, {
      global: true,
      timeWindow: env.RATE_LIMIT_WINDOW_MS,
      keyGenerator: (request) => request.ip,
      redis: rateLimitStore.client,
      // A limiter that cannot reach its store must not take requests down with
      // it: count when possible, serve regardless.
      skipOnError: true,
      max: (request, _key) => {
        const path = request.url.split("?")[0] ?? "";
        if (path.includes(OAUTH_TOKEN_PATH)) return env.OAUTH_RATE_LIMIT_MAX;
        if (SENSITIVE_AUTH_PATHS.some((p) => path.includes(p))) {
          return env.SENSITIVE_RATE_LIMIT_MAX;
        }
        return env.RATE_LIMIT_MAX;
      },
      // Throttling is currently invisible: a user hitting the ceiling reports
      // "the app is broken sometimes" and nothing correlates it. Log it so the
      // ceiling is observable before it is raised.
      onExceeding: (request, key) => {
        request.log.info({ key, url: request.url }, "rate limit approaching");
      },
      onExceeded: (request, key) => {
        request.log.warn({ key, url: request.url }, "rate limit exceeded");
      },
    });

    registerAuthMiddleware(app, {
      jwksUrl: env.JWKS_URL,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });

    // Registered before the proxies so the aggregated desk answers on
    // /api/v1/approvals/desk rather than being swallowed by a prefix match.
    registerApprovalsDesk(app);

    for (const config of sortedUpstreamRoutes()) {
      // A loopback upstream in production means the UPSTREAM_* variable is unset
      // and routes.ts fell back to its local default. Proxying there produces a
      // connection-refused 502 that reads as "this service is down", sending
      // whoever debugs it to look at a service that may not be deployed at all.
      // Answer plainly instead, and name the variable to set.
      if (env.NODE_ENV === "production" && isLoopbackUpstream(config.upstream)) {
        const body = unconfiguredUpstreamBody(config);
        const handler = async (_request: unknown, reply: FastifyReply) =>
          reply.status(503).send(body);
        app.all(config.prefix, handler);
        app.all(`${config.prefix}/*`, handler);

        logger.error(
          { prefix: config.prefix, envKey: config.envKey, upstream: config.upstream },
          "upstream not configured — every request to this prefix will 503; set the env var or remove the route",
        );
        continue;
      }

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
    }

    const unconfigured = env.NODE_ENV === "production" ? unconfiguredUpstreams() : [];
    if (unconfigured.length > 0) {
      logger.error(
        {
          count: unconfigured.length,
          missing: unconfigured.map((r) => r.envKey),
        },
        "gateway started with unconfigured upstreams",
      );
    }

    // One place to see which routes are live without reading boot logs or
    // probing each prefix by hand.
    app.get("/api/v1", async () => ({
      platform: "IAG",
      routes: Object.keys(upstreamRoutes),
      unconfigured: unconfigured.map((r) => ({ prefix: r.prefix, envKey: r.envKey })),
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
