import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appendVary,
  cacheControlFor,
  isNoStorePath,
  matchCachePolicy,
  type CachePolicy,
} from "./cache.js";

const POLICIES: CachePolicy[] = [
  { prefix: "/api/v1/finance/v1", maxAgeSeconds: 30 },
  { prefix: "/api/v1/finance/v1/chart-of-accounts", maxAgeSeconds: 120 },
];

describe("gateway cache policy", () => {
  it("caches a matching safe GET as private", () => {
    const value = cacheControlFor({
      method: "GET",
      path: "/api/v1/finance/v1/chart-of-accounts",
      statusCode: 200,
      policies: POLICIES,
    });
    assert.equal(value, "private, max-age=120, must-revalidate");
  });

  it("prefers the longest matching prefix", () => {
    const policy = matchCachePolicy("/api/v1/finance/v1/chart-of-accounts/42", POLICIES);
    assert.equal(policy?.maxAgeSeconds, 120);
  });

  it("does not treat a prefix as matching a longer sibling segment", () => {
    // /api/v1/finance/v1x must not match the /api/v1/finance/v1 policy.
    const policy = matchCachePolicy("/api/v1/finance/v1x/ledger", POLICIES);
    assert.equal(policy, undefined);
  });

  it("never caches an unsafe method", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const value = cacheControlFor({
        method,
        path: "/api/v1/finance/v1/chart-of-accounts",
        statusCode: 200,
        policies: POLICIES,
      });
      assert.equal(value, undefined, `${method} must not be cached`);
    }
  });

  it("never caches a non-200", () => {
    for (const statusCode of [201, 204, 304, 400, 403, 500]) {
      const value = cacheControlFor({
        method: "GET",
        path: "/api/v1/finance/v1/chart-of-accounts",
        statusCode,
        policies: POLICIES,
      });
      assert.equal(value, undefined, `${statusCode} must not be cached`);
    }
  });

  it("defers to an upstream that set its own Cache-Control", () => {
    const value = cacheControlFor({
      method: "GET",
      path: "/api/v1/finance/v1/chart-of-accounts",
      statusCode: 200,
      upstreamCacheControl: "no-cache",
      policies: POLICIES,
    });
    assert.equal(value, undefined);
  });

  it("leaves unlisted paths untouched", () => {
    const value = cacheControlFor({
      method: "GET",
      path: "/api/v1/fleet/api/vehicles",
      statusCode: 200,
      policies: POLICIES,
    });
    assert.equal(value, undefined);
  });

  it("ships with an empty policy table so nothing is cached by default", async () => {
    const { CACHE_POLICIES } = await import("./cache.js");
    assert.equal(CACHE_POLICIES.length, 0);
  });
});

describe("no-store paths", () => {
  it("forces no-store on token responses regardless of method or status", () => {
    const value = cacheControlFor({
      method: "POST",
      path: "/api/v1/authentication/oauth/token",
      statusCode: 200,
      policies: POLICIES,
    });
    assert.equal(value, "no-store");
  });

  it("overrides an upstream Cache-Control on credential paths", () => {
    const value = cacheControlFor({
      method: "POST",
      path: "/api/v1/authentication/v1/share-tokens",
      statusCode: 201,
      upstreamCacheControl: "public, max-age=600",
      policies: POLICIES,
    });
    assert.equal(value, "no-store");
  });

  it("matches sub-paths but not unrelated siblings", () => {
    assert.equal(isNoStorePath("/api/v1/authentication/oauth/token/introspect"), true);
    assert.equal(isNoStorePath("/api/v1/authentication/oauth/tokeninfo"), false);
  });
});

describe("appendVary", () => {
  it("sets the field when none exists", () => {
    assert.equal(appendVary(undefined, "Authorization"), "Authorization");
    assert.equal(appendVary("", "Authorization"), "Authorization");
  });

  it("appends without duplicating, case-insensitively", () => {
    assert.equal(appendVary("Origin", "Authorization"), "Origin, Authorization");
    assert.equal(appendVary("Origin, authorization", "Authorization"), "Origin, authorization");
  });

  it("handles an array-valued header", () => {
    assert.equal(appendVary(["Origin", "Accept"], "Authorization"), "Origin, Accept, Authorization");
  });
});
