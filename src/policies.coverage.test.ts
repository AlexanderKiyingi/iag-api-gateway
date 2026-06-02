import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchPolicy } from "./policies.js";
import { isProxiedPath, upstreamRoutes } from "./routes.js";

/** Sample paths each upstream must cover with at least one policy. */
const SAMPLE_PATHS: Record<string, string[]> = {
  "/api/v1/authentication": [
    "/api/v1/authentication/oauth/token",
    "/api/v1/authentication/v1/users/me",
    "/api/v1/authentication/v1/admin/audit",
  ],
  "/api/v1/notifications": [
    "/api/v1/notifications/v1/dispatch",
    "/api/v1/notifications/health",
  ],
  "/api/v1/reports": ["/api/v1/reports/health", "/api/v1/reports/v1/summary"],
  "/api/v1/accounts": [
    "/api/v1/accounts/health",
    "/api/v1/accounts/v1/chart-of-accounts",
  ],
  "/api/v1/finance": [
    "/api/v1/finance/health",
    "/api/v1/finance/v1/chart-of-accounts",
    "/api/v1/finance/v1/ledger/entries",
  ],
  "/api/v1/supply-chain": [
    "/api/v1/supply-chain/public/q/x",
    "/api/v1/supply-chain/api/v1/farmers",
  ],
  "/api/v1/fleet/api/iot/pings": ["/api/v1/fleet/api/iot/pings"],
  "/api/v1/fleet": ["/api/v1/fleet/api/vehicles", "/api/v1/fleet/api/admin/audit-logs"],
  "/api/v1/project-management": [
    "/api/v1/project-management/api/v1/projects",
  ],
  "/api/v1/procurement": [
    "/api/v1/procurement/health",
    "/api/v1/procurement/api/v1/requisitions",
    "/api/v1/procurement/api/v1/admin/audit-logs",
  ],
  "/api/v1/contract-management": [
    "/api/v1/contract-management/ready",
    "/api/v1/contract-management/v1/contracts",
    "/api/v1/contract-management/v1/audit",
    "/api/v1/contract-management/v1/admin/audit-logs",
    "/api/v1/contract-management/v1/health",
  ],
  "/api/v1/crm": [
    "/api/v1/crm/v1/accounts",
    "/api/v1/crm/v1/audit",
    "/api/v1/crm/v1/admin/monitoring/summary",
    "/api/v1/crm/health",
  ],
  "/api/v1/dms": [
    "/api/v1/dms/v1/overview",
    "/api/v1/dms/v1/outlets",
    "/api/v1/dms/v1/field/check-ins",
    "/api/v1/dms/v1/reports/run",
    "/api/v1/dms/v1/exports/outlets",
    "/api/v1/dms/v1/insights/signals",
    "/api/v1/dms/v1/admin/monitoring/summary",
    "/api/v1/dms/v1/audit",
    "/api/v1/dms/health",
  ],
  "/api/v1/users": [
    "/api/v1/users/health",
    "/api/v1/users/v1/me/profile",
    "/api/v1/users/v1/orgs",
    "/api/v1/users/v1/admin/users",
    "/api/v1/users/v1/admin/audit-logs",
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

  it("operations services require permission codenames at gateway", () => {
    const cases: Array<{ path: string; method: string }> = [
      { path: "/api/v1/fleet/api/vehicles", method: "GET" },
      { path: "/api/v1/procurement/api/v1/requisitions", method: "GET" },
      { path: "/api/v1/supply-chain/api/v1/farmers", method: "GET" },
      { path: "/api/v1/project-management/api/v1/projects", method: "GET" },
    ];
    for (const { path, method } of cases) {
      const policy = matchPolicy(path, method);
      assert.ok(policy?.permissions?.length, `${method} ${path} should require permissions`);
    }
  });
});
