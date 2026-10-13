import { test } from "node:test";
import assert from "node:assert/strict";
import { bucketFor, principalRateLimitKey, rateLimitKey } from "./ratelimit-policy.js";

test("public share surfaces draw on their own budget", () => {
  for (const url of [
    "/api/v1/traceability/public/q/abc",
    "/api/v1/traceability/public/q/abc/qr.png",
    "/api/v1/project-management/shared/tok/task/42",
    "/api/v1/quality-control/public/coa/xyz?x=1",
    "/api/v1/supply-chain/public/q/abc",
  ]) {
    assert.equal(bucketFor(url), "public-share", url);
    assert.equal(rateLimitKey(url, "41.210.1.1"), "anon:41.210.1.1", url);
  }
});

test("signed-in and auth traffic keep their budgets", () => {
  assert.equal(bucketFor("/api/v1/quality-control/api/v1/samples"), "default");
  assert.equal(rateLimitKey("/api/v1/quality-control/api/v1/samples", "1.2.3.4"), "1.2.3.4");
  assert.equal(bucketFor("/api/v1/authentication/oauth/token"), "oauth");
  assert.equal(bucketFor("/api/v1/authentication/v1/share-tokens"), "sensitive");
  // A path that merely starts with the same letters is not a share surface.
  assert.equal(bucketFor("/api/v1/traceability/publication"), "default");
});

test("each signed-in user, and each service client, gets a budget of their own", () => {
  assert.equal(principalRateLimitKey({ sub: "u-1" }), "user:u-1");
  assert.equal(principalRateLimitKey({ sub: "u-2", principal_type: "user" }), "user:u-2");
  assert.equal(principalRateLimitKey({ sub: "svc-1", principal_type: "service", client_id: "iag-fleet" }), "svc:iag-fleet");
  assert.equal(principalRateLimitKey({ sub: "svc-1", principal_type: "service" }), "svc:svc-1");
  // Two users behind one server address must not share a key.
  assert.notEqual(principalRateLimitKey({ sub: "a" }), principalRateLimitKey({ sub: "b" }));
});
