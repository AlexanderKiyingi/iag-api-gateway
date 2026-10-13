import assert from "node:assert/strict";
import { createSign, generateKeyPairSync, randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import Fastify, { type FastifyInstance } from "fastify";
import { registerAuthMiddleware } from "./middleware/auth.js";
import { matchPolicy } from "./policies.js";
import { matchUpstreamRoute, rewriteUpstreamPath, upstreamRoutes } from "./routes.js";
import { PLATFORM_ACCESS, scmMutatePermissions, scmViewPermissions } from "./service-permissions.js";
import { serviceFromPath } from "./usage.js";

const GATE = "platform.access_farmer_services";

describe("farmer-services route", () => {
  it("proxies /api/v1/farmer-services to the service root", () => {
    const route = matchUpstreamRoute("/api/v1/farmer-services/v1/notices");
    assert.equal(route?.prefix, "/api/v1/farmer-services");
    assert.equal(route?.envKey, "UPSTREAM_FARMER_SERVICES");
    assert.equal(rewriteUpstreamPath("/api/v1/farmer-services/v1/notices/n1", route!), "/v1/notices/n1");
    assert.equal(rewriteUpstreamPath("/api/v1/farmer-services/ready", route!), "/ready");
  });

  it("counts tool usage against the farmer-services upstream", () => {
    assert.equal(serviceFromPath("/api/v1/farmer-services/v1/surveys"), "farmer-services");
  });

  it("keeps the probes public and gates everything under /v1", () => {
    assert.equal(PLATFORM_ACCESS.farmerServices, GATE);
    for (const p of ["/api/v1/farmer-services/health", "/api/v1/farmer-services/ready"]) {
      assert.equal(matchPolicy(p, "GET")?.public, true, p);
    }
    const paths = [
      "/api/v1/farmer-services/v1/marketplace",
      "/api/v1/farmer-services/v1/notices/n1/publish",
      "/api/v1/farmer-services/v1/surveys",
      "/api/v1/farmer-services/v1/rewards/r1/redeem",
      "/api/v1/farmer-services/v1/support-tickets",
      "/api/v1/farmer-services/v1/disputes/d1/resolve",
      "/api/v1/farmer-services/v1/farmgate-prices",
      "/api/v1/farmer-services/v1/sms-blasts/b1/send",
      "/api/v1/farmer-services/v1/loans",
    ];
    for (const p of paths) {
      for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
        const policy = matchPolicy(p, method);
        assert.ok(policy, `${method} ${p}`);
        assert.notEqual(policy.public, true, `${method} ${p}`);
        assert.deepEqual(policy.requireAllPermissions, [GATE], `${method} ${p}`);
      }
    }
  });
});

describe("supply-chain plots, harvest lots and collections", () => {
  it("reach SCM behind the supply-chain gate", () => {
    for (const p of [
      "/api/v1/supply-chain/api/v1/plots",
      "/api/v1/supply-chain/api/v1/farms/f1/plots",
      "/api/v1/supply-chain/api/v1/harvest-lots/h1/batches",
      "/api/v1/supply-chain/api/v1/collections/c1/receive",
    ]) {
      for (const method of ["GET", "POST"]) {
        assert.deepEqual(matchPolicy(p, method)?.requireAllPermissions, [PLATFORM_ACCESS.supplyChain], `${method} ${p}`);
      }
    }
  });

  // The lists are an any-of pre-filter: a harvest clerk holding only the
  // harvest-lot codenames must not be refused before SCM's own check runs.
  it("lets the harvest-lot and collection codenames through the any-of filter", () => {
    for (const c of ["traceability.view_harvestlot", "traceability.view_collection", "scm.view_supplier"]) {
      assert.ok(scmViewPermissions.includes(c), c);
    }
    for (const c of [
      "traceability.add_harvestlot", "traceability.change_harvestlot", "traceability.delete_harvestlot",
      "traceability.add_collection", "traceability.change_collection", "scm.change_supplier",
    ]) {
      assert.ok(scmMutatePermissions.includes(c), c);
    }
    assert.deepEqual(matchPolicy("/api/v1/supply-chain/api/v1/harvest-lots", "GET")?.permissions, scmViewPermissions);
    assert.deepEqual(matchPolicy("/api/v1/supply-chain/api/v1/collections/c1/pay", "POST")?.permissions, scmMutatePermissions);
    assert.deepEqual(matchPolicy("/api/v1/supply-chain/api/v1/plots/p1", "DELETE")?.permissions, scmMutatePermissions);
  });
});

// The middleware end to end: a real RS256 token checked against a local JWKS.
describe("farmer-services gateway enforcement", () => {
  const ISSUER = "http://auth.test";
  const AUDIENCE = "iag.gateway";
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const kid = "test-key";
  let jwks: Server;
  let app: FastifyInstance;

  function token(claims: Record<string, unknown>): string {
    const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const head = b64({ alg: "RS256", typ: "JWT", kid });
    const body = b64({ iss: ISSUER, aud: [AUDIENCE, "iag.farmer-services"], sub: randomUUID(), iat: now, exp: now + 300, ...claims });
    const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(privateKey).toString("base64url");
    return `${head}.${body}.${sig}`;
  }

  before(async () => {
    const jwk = { ...publicKey.export({ format: "jwk" }), kid, alg: "RS256", use: "sig" };
    jwks = createServer((_req, res) => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ keys: [jwk] }));
    });
    await new Promise<void>((resolve) => jwks.listen(0, "127.0.0.1", resolve));
    const { port } = jwks.address() as AddressInfo;

    app = Fastify();
    registerAuthMiddleware(app, { jwksUrl: `http://127.0.0.1:${port}/jwks.json`, issuer: ISSUER, audience: AUDIENCE });
    // Stand-in for the proxy: reaching the handler means the gateway let it through.
    app.all("/api/v1/farmer-services/*", async () => ({ proxied: true }));
    await app.ready();
  });

  after(async () => {
    await app.close();
    await new Promise<void>((resolve) => jwks.close(() => resolve()));
  });

  const call = (method: "GET" | "POST", url: string, bearer?: string) =>
    app.inject({ method, url, headers: bearer ? { authorization: `Bearer ${bearer}` } : {}, payload: method === "POST" ? {} : undefined });

  it("lets the health probe through without a token", async () => {
    assert.equal((await call("GET", "/api/v1/farmer-services/health")).statusCode, 200);
  });

  it("refuses an unauthenticated read with 401", async () => {
    assert.equal((await call("GET", "/api/v1/farmer-services/v1/notices")).statusCode, 401);
  });

  it("refuses a caller without platform.access_farmer_services with 403", async () => {
    const t = token({ groups: ["user"], permissions: ["platform.access_traceability", "farmer_services.view_notice"] });
    for (const method of ["GET", "POST"] as const) {
      const res = await call(method, "/api/v1/farmer-services/v1/notices", t);
      assert.equal(res.statusCode, 403, method);
    }
  });

  it("passes reads and writes for a caller holding the gate", async () => {
    const t = token({ groups: ["user"], permissions: [GATE] });
    for (const method of ["GET", "POST"] as const) {
      const res = await call(method, "/api/v1/farmer-services/v1/notices", t);
      assert.equal(res.statusCode, 200, method);
      assert.deepEqual(res.json(), { proxied: true });
    }
  });
});

it("registers the farmer-services upstream with a loopback default for local runs", () => {
  const route = upstreamRoutes["/api/v1/farmer-services"];
  assert.ok(route);
  if (!process.env.UPSTREAM_FARMER_SERVICES) {
    assert.equal(route.upstream, "http://127.0.0.1:4021");
  }
});
