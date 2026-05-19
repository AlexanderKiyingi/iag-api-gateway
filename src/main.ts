import httpProxy from "@fastify/http-proxy";
import { createService } from "@iag/service-core";
import { loadGatewayEnv } from "./config.js";
import { registerAuthMiddleware } from "./middleware/auth.js";
import { upstreamRoutes } from "./routes.js";

const env = loadGatewayEnv();

const service = await createService({
  serviceName: "api-gateway",
  port: env.PORT,
  async registerRoutes(app, logger) {
    registerAuthMiddleware(app, {
      jwksUrl: env.JWKS_URL,
      issuer: env.JWT_ISSUER,
      gatewayInternalSecret: env.GATEWAY_INTERNAL_SECRET,
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
