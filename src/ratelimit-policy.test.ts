import { test } from "node:test";
import assert from "node:assert/strict";
import { bucketFor, rateLimitKey } from "./ratelimit-policy.js";

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
