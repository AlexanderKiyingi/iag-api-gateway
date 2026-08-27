import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { unconfiguredUpstreamBody, upstreamUnavailableMessage } from "./errors.js";
import { isLoopbackUpstream, upstreamRoutes } from "./routes.js";

describe("isLoopbackUpstream", () => {
  it("detects the local fallbacks routes.ts uses", () => {
    assert.equal(isLoopbackUpstream("http://127.0.0.1:4003"), true);
    assert.equal(isLoopbackUpstream("http://localhost:3003"), true);
    assert.equal(isLoopbackUpstream("http://[::1]:4104"), true);
  });

  it("treats a real Railway internal address as configured", () => {
    assert.equal(isLoopbackUpstream("http://iag-finance.railway.internal:3006"), false);
    assert.equal(isLoopbackUpstream("https://iag-fleet.example.com"), false);
  });

  // Railway template refs like ${{svc.RAILWAY_PRIVATE_DOMAIN}} are substituted
  // before the process sees them. If one ever arrives unsubstituted it is not a
  // parseable URL, and must not be mistaken for a working upstream.
  it("does not classify an unparseable upstream as loopback", () => {
    assert.equal(isLoopbackUpstream("http://${{iag-erp.RAILWAY_PRIVATE_DOMAIN}}:8080"), false);
    assert.equal(isLoopbackUpstream(""), false);
  });
});

describe("unconfigured upstream response", () => {
  it("names the variable to set rather than blaming the service", () => {
    const body = unconfiguredUpstreamBody({ prefix: "/api/v1/chat", envKey: "UPSTREAM_CHAT" });
    assert.equal(body.error.code, "UPSTREAM_NOT_CONFIGURED");
    assert.match(body.error.message, /UPSTREAM_CHAT/);
    assert.match(body.error.message, /\/api\/v1\/chat/);
    assert.equal(body.upstream, "/api/v1/chat");
  });

  // The distinction is the point: one sends you to the service's logs, the
  // other to the gateway's environment.
  it("reads differently from a genuine outage", () => {
    const notConfigured = unconfiguredUpstreamBody({
      prefix: "/api/v1/finance",
      envKey: "UPSTREAM_FINANCE",
    }).error.message;
    assert.notEqual(notConfigured, upstreamUnavailableMessage("/api/v1/finance"));
    assert.match(upstreamUnavailableMessage("/api/v1/finance"), /unavailable/);
  });
});

describe("route table", () => {
  it("every route carries the env key it reads", () => {
    for (const [key, route] of Object.entries(upstreamRoutes)) {
      assert.ok(route.envKey, `${key} is missing envKey`);
      assert.match(route.envKey, /^UPSTREAM_[A-Z0-9_]+$/, `${key} has a malformed envKey`);
    }
  });

  it("gives each route a distinct env key, so one variable cannot silently drive two prefixes", () => {
    const keys = Object.values(upstreamRoutes).map((r) => r.envKey);
    assert.equal(new Set(keys).size, keys.length);
  });
});

/**
 * The production env template is the only place a deployer learns which
 * UPSTREAM_* variables exist. A route added to routes.ts without a matching
 * line there deploys with the loopback fallback still in place — which on
 * Railway is the gateway's own container, so the route answers "connection
 * refused" and looks like the upstream service is down.
 *
 * That already happened once with UPSTREAM_ERP and was fixed by hand. This
 * catches the next one at build time instead.
 */
describe("production env template", () => {
  const templatePath = new URL("../config/.env.production.example", import.meta.url);
  const template = readFileSync(templatePath, "utf8");
  const assigned = new Set(
    template
      .split("\n")
      .map((line) => /^(UPSTREAM_[A-Z0-9_]+)=/.exec(line.trim())?.[1])
      .filter((key): key is string => Boolean(key)),
  );

  it("assigns every UPSTREAM_* variable the route table reads", () => {
    const missing = Object.values(upstreamRoutes)
      .map((route) => route.envKey)
      .filter((key) => !assigned.has(key))
      .sort();
    assert.deepEqual(
      missing,
      [],
      `routes.ts reads these UPSTREAM_* variables that config/.env.production.example never assigns: ${missing.join(", ")}`,
    );
  });

  // The reverse drift is quieter but still misleading: a deployer sets a
  // variable the gateway stopped reading and believes the route is wired.
  it("does not assign variables no route reads", () => {
    const read = new Set(Object.values(upstreamRoutes).map((route) => route.envKey));
    const orphaned = [...assigned].filter((key) => !read.has(key)).sort();
    assert.deepEqual(
      orphaned,
      [],
      `config/.env.production.example assigns these UPSTREAM_* variables that no route reads: ${orphaned.join(", ")}`,
    );
  });
});
