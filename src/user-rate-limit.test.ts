// The per-user budget, end to end through the real auth middleware: two
// people behind one address (a frontend's server) must not share a limit.
import assert from "node:assert/strict";
import { generateKeyPairSync, createSign } from "node:crypto";
import { createServer, type Server } from "node:http";
import { after, before, test } from "node:test";
import Fastify, { type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { registerAuthMiddleware } from "./middleware/auth.js";
import { principalRateLimitKey } from "./ratelimit-policy.js";

const ISSUER = "https://auth.test";
const AUDIENCE = "iag.gateway";
const KID = "test";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

function token(sub: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "RS256", typ: "JWT", kid: KID });
  const body = b64({ sub, iss: ISSUER, aud: [AUDIENCE], iat: now, exp: now + 600, groups: ["user"] });
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(privateKey).toString("base64url");
  return `${head}.${body}.${sig}`;
}

let jwks: Server;
let app: FastifyInstance;

before(async () => {
  jwks = createServer((_req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ keys: [{ ...publicKey.export({ format: "jwk" }), kid: KID, alg: "RS256", use: "sig" }] }));
  });
  await new Promise<void>((r) => jwks.listen(0, "127.0.0.1", () => r()));
  const port = (jwks.address() as { port: number }).port;

  app = Fastify();
  // Per-IP ceiling, as in main.ts, set high: it must not be what stops a user.
  await app.register(rateLimit, { global: true, max: 1000, timeWindow: 60_000 });
  const limiter = app.createRateLimit({
    max: 3,
    timeWindow: 60_000,
    keyGenerator: (request) => (request.auth ? principalRateLimitKey(request.auth) : `ip:${request.ip}`),
  });
  registerAuthMiddleware(
    app,
    { jwksUrl: `http://127.0.0.1:${port}/jwks`, issuer: ISSUER, audience: AUDIENCE },
    limiter,
  );
  app.get("/api/v1/authentication/v1/users/me", async () => ({ ok: true }));
  await app.ready();
});

after(async () => {
  await app.close();
  jwks.close();
});

const call = (bearer?: string) =>
  app.inject({
    method: "GET",
    url: "/api/v1/authentication/v1/users/me",
    headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
  });

test("one user spending their budget does not stop another behind the same address", async () => {
  const alice = token("alice");
  const bob = token("bob");
  for (let i = 0; i < 3; i += 1) assert.equal((await call(alice)).statusCode, 200, `alice #${i + 1}`);

  const refused = await call(alice);
  assert.equal(refused.statusCode, 429);
  assert.ok(Number(refused.headers["retry-after"]) > 0, "retry-after is set");
  assert.match(refused.body, /TOO_MANY_REQUESTS/);

  // Same IP (inject uses one address), different person: still served.
  assert.equal((await call(bob)).statusCode, 200);
});

test("a request without a valid token is refused before it can spend any budget", async () => {
  assert.equal((await call()).statusCode, 401);
  assert.equal((await call("not.a.token")).statusCode, 401);
});
