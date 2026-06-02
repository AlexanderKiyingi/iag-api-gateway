import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  matchUpstreamRoute,
  rewriteUpstreamPath,
  upstreamRoutes,
} from "./routes.js";

/** Gateway path → expected upstream path after prefix rewrite. */
const REWRITE_CASES: Array<{
  gatewayPath: string;
  upstreamPath: string;
  upstreamKey: string;
}> = [
  {
    gatewayPath: "/api/v1/authentication/oauth/token",
    upstreamPath: "/oauth/token",
    upstreamKey: "/api/v1/authentication",
  },
  {
    gatewayPath: "/api/v1/authentication/.well-known/jwks.json",
    upstreamPath: "/.well-known/jwks.json",
    upstreamKey: "/api/v1/authentication",
  },
  {
    gatewayPath: "/api/v1/authentication/v1/users/me",
    upstreamPath: "/v1/users/me",
    upstreamKey: "/api/v1/authentication",
  },
  {
    gatewayPath: "/api/v1/notifications/v1/dispatch",
    upstreamPath: "/v1/dispatch",
    upstreamKey: "/api/v1/notifications",
  },
  {
    gatewayPath: "/api/v1/reports/v1/reports",
    upstreamPath: "/v1/reports",
    upstreamKey: "/api/v1/reports",
  },
  {
    gatewayPath: "/api/v1/users/v1/me/profile",
    upstreamPath: "/v1/me/profile",
    upstreamKey: "/api/v1/users",
  },
  {
    gatewayPath: "/api/v1/finance/v1/chart-of-accounts",
    upstreamPath: "/v1/chart-of-accounts",
    upstreamKey: "/api/v1/finance",
  },
  {
    gatewayPath: "/api/v1/accounts/v1/chart-of-accounts",
    upstreamPath: "/v1/chart-of-accounts",
    upstreamKey: "/api/v1/accounts",
  },
  {
    gatewayPath: "/api/v1/supply-chain/api/v1/farmers",
    upstreamPath: "/api/v1/farmers",
    upstreamKey: "/api/v1/supply-chain",
  },
  {
    gatewayPath: "/api/v1/supply-chain/public/q/demo",
    upstreamPath: "/public/q/demo",
    upstreamKey: "/api/v1/supply-chain",
  },
  {
    gatewayPath: "/api/v1/fleet/api/iot/pings",
    upstreamPath: "/api/iot/pings",
    upstreamKey: "/api/v1/fleet/api/iot/pings",
  },
  {
    gatewayPath: "/api/v1/fleet/api/vehicles",
    upstreamPath: "/api/vehicles",
    upstreamKey: "/api/v1/fleet",
  },
  {
    gatewayPath: "/api/v1/project-management/api/v1/projects",
    upstreamPath: "/api/v1/projects",
    upstreamKey: "/api/v1/project-management",
  },
  {
    gatewayPath: "/api/v1/procurement/api/v1/requisitions",
    upstreamPath: "/api/v1/requisitions",
    upstreamKey: "/api/v1/procurement",
  },
  {
    gatewayPath: "/api/v1/contract-management/v1/contracts",
    upstreamPath: "/v1/contracts",
    upstreamKey: "/api/v1/contract-management",
  },
  {
    gatewayPath: "/api/v1/crm/v1/accounts",
    upstreamPath: "/v1/accounts",
    upstreamKey: "/api/v1/crm",
  },
  {
    gatewayPath: "/api/v1/dms/v1/outlets",
    upstreamPath: "/v1/outlets",
    upstreamKey: "/api/v1/dms",
  },
  {
    gatewayPath: "/api/v1/dms/assets/logo.png",
    upstreamPath: "/assets/logo.png",
    upstreamKey: "/api/v1/dms",
  },
];

describe("gateway upstream routing", () => {
  it("every upstream prefix has a configured rewrite target", () => {
    for (const route of Object.values(upstreamRoutes)) {
      assert.ok(route.upstream.startsWith("http"), route.prefix);
      assert.ok(route.rewritePrefix.startsWith("/"), route.prefix);
    }
  });

  it("rewrites gateway paths to each microservice's native routes", () => {
    for (const { gatewayPath, upstreamPath, upstreamKey } of REWRITE_CASES) {
      const route = upstreamRoutes[upstreamKey];
      assert.ok(route, `missing upstream ${upstreamKey}`);
      assert.equal(
        rewriteUpstreamPath(gatewayPath, route),
        upstreamPath,
        gatewayPath,
      );
    }
  });

  it("prefers the fleet IoT ingest route over the fleet catch-all", () => {
    const matched = matchUpstreamRoute("/api/v1/fleet/api/iot/pings");
    assert.equal(matched?.prefix, "/api/v1/fleet/api/iot/pings");
    assert.equal(matched?.rewritePrefix, "/api/iot/pings");
  });

  it("legacy accounts prefix rewrites to finance service paths", () => {
    const accounts = upstreamRoutes["/api/v1/accounts"];
    const finance = upstreamRoutes["/api/v1/finance"];
    assert.equal(accounts.upstream, finance.upstream);
    assert.equal(
      rewriteUpstreamPath("/api/v1/accounts/v1/ledger/entries", accounts),
      rewriteUpstreamPath("/api/v1/finance/v1/ledger/entries", finance),
    );
  });
});
