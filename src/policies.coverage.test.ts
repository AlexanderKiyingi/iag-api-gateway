import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchPolicy } from "./policies.js";
import { isProxiedPath, upstreamRoutes } from "./routes.js";

/** Sample paths each upstream must cover with at least one policy. */
const SAMPLE_PATHS: Record<string, string[]> = {
  "/api/v1/authentication": [
    "/api/v1/authentication/oauth/token",
    "/api/v1/authentication/v1/me",
  ],
  "/api/v1/notifications": [
    "/api/v1/notifications/v1/dispatch",
    "/api/v1/notifications/health",
  ],
  "/api/v1/reports": ["/api/v1/reports/health", "/api/v1/reports/v1/summary"],
  "/api/v1/accounts": ["/api/v1/accounts/health", "/api/v1/accounts/v1/ledgers"],
  "/api/v1/supply-chain": [
    "/api/v1/supply-chain/public/q/x",
    "/api/v1/supply-chain/api/v1/farmers",
  ],
  "/api/v1/fleet": [
    "/api/v1/fleet/api/iot/pings",
    "/api/v1/fleet/api/vehicles",
  ],
  "/api/v1/project-management": [
    "/api/v1/project-management/api/v1/projects",
  ],
};

describe("policy coverage", () => {
  it("every registered upstream has sample paths", () => {
    for (const prefix of Object.keys(upstreamRoutes)) {
      assert.ok(
        SAMPLE_PATHS[prefix]?.length,
        `missing SAMPLE_PATHS for ${prefix}`,
      );
    }
  });

  it("every sample proxied path has a route policy", () => {
    const methods: Record<string, string> = {
      "/api/v1/notifications/v1/dispatch": "POST",
      "/api/v1/fleet/api/iot/pings": "POST",
    };
    for (const [prefix, paths] of Object.entries(SAMPLE_PATHS)) {
      for (const path of paths) {
        assert.equal(isProxiedPath(path), true, `${path} should be proxied`);
        const method = methods[path] ?? "GET";
        const policy = matchPolicy(path, method);
        assert.ok(
          policy,
          `no policy for ${method} ${path} (upstream ${prefix}) — add to policies.ts`,
        );
      }
    }
  });

  it("oauth token path is public", () => {
    const policy = matchPolicy(
      "/api/v1/authentication/oauth/token",
      "POST",
    );
    assert.equal(policy?.public, true);
  });
});
