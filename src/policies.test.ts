import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isProxiedPath } from "./routes.js";
import { matchPolicy } from "./policies.js";
import { PLATFORM_ACCESS, mesAdminWritePermissions, mesMutatePermissions, mesViewPermissions, productionAdminWritePermissions, productionMutatePermissions, productionViewPermissions, scmViewPermissions } from "./service-permissions.js";

describe("gateway policies", () => {
  it("proxied paths without policy are identifiable", () => {
    assert.equal(isProxiedPath("/api/v1/accounts/v1/ledgers"), true);
    assert.equal(isProxiedPath("/health"), false);
    assert.equal(isProxiedPath("/api/v1"), false);
  });

  // The reports equivalents of these two lived here until the route was
  // removed; the supply-chain pair below covers the same two policy shapes.
  it("matches public supply-chain QR", () => {
    const policy = matchPolicy("/api/v1/supply-chain/public/q/demo", "GET");
    assert.equal(policy?.public, true);
  });

  it("matches scm view permissions on supply-chain API", () => {
    const policy = matchPolicy("/api/v1/supply-chain/api/v1/farmers", "GET");
    assert.deepEqual(policy?.permissions, scmViewPermissions);
    assert.deepEqual(policy?.requireAllPermissions, [
      PLATFORM_ACCESS.supplyChain,
    ]);
  });

  it("requires platform.access_crm on CRM catch-all", () => {
    const policy = matchPolicy("/api/v1/crm/v1/contacts", "GET");
    assert.deepEqual(policy?.requireAllPermissions, [PLATFORM_ACCESS.crm]);
  });

  it("matches mes view permissions on MES GET API", () => {
    const policy = matchPolicy("/api/v1/mes/api/v1/bootstrap", "GET");
    assert.deepEqual(policy?.permissions, mesViewPermissions);
    assert.deepEqual(policy?.requireAllPermissions, [PLATFORM_ACCESS.mes]);
  });

  it("matches mes mutate permissions on MES POST API", () => {
    const policy = matchPolicy("/api/v1/mes/api/v1/work-orders", "POST");
    assert.deepEqual(policy?.permissions, mesMutatePermissions);
    assert.deepEqual(policy?.requireAllPermissions, [PLATFORM_ACCESS.mes]);
  });

  it("matches production view permissions on production GET API", () => {
    const policy = matchPolicy("/api/v1/production/api/v1/bootstrap", "GET");
    assert.deepEqual(policy?.permissions, productionViewPermissions);
    assert.deepEqual(policy?.requireAllPermissions, [PLATFORM_ACCESS.production]);
  });

  it("matches production mutate permissions on production POST API", () => {
    const policy = matchPolicy("/api/v1/production/api/v1/production-runs", "POST");
    assert.deepEqual(policy?.permissions, productionMutatePermissions);
    assert.deepEqual(policy?.requireAllPermissions, [PLATFORM_ACCESS.production]);
  });

  it("matches production admin write on admin POST API", () => {
    const policy = matchPolicy(
      "/api/v1/production/api/v1/admin/integrations/erp/sync",
      "POST",
    );
    assert.deepEqual(policy?.permissions, productionAdminWritePermissions);
    assert.deepEqual(policy?.requireAllPermissions, [PLATFORM_ACCESS.production]);
  });

  it("matches mes admin write on MES admin POST API", () => {
    const policy = matchPolicy(
      "/api/v1/mes/api/v1/admin/jobs/kpi-rollup",
      "POST",
    );
    assert.deepEqual(policy?.permissions, mesAdminWritePermissions);
    assert.deepEqual(policy?.requireAllPermissions, [PLATFORM_ACCESS.mes]);
  });

  it("allows self profile without platform.access_users", () => {
    const policy = matchPolicy("/api/v1/users/v1/me/profile", "GET");
    assert.equal(policy?.authenticated, true);
    assert.equal(policy?.requireAllPermissions, undefined);
  });
});

describe("aggregated approval desk", () => {
  it("is authenticated by the gateway, not left to the upstreams", () => {
    const policy = matchPolicy("/api/v1/approvals/desk", "GET");
    assert.ok(policy, "the desk route must have a policy — the auth hook skips unmatched non-proxied paths");
    assert.equal(policy?.authenticated, true);
    assert.notEqual(policy?.public, true);
  });

  it("is not a proxied path, so it cannot be swallowed by an upstream prefix", () => {
    assert.equal(isProxiedPath("/api/v1/approvals/desk"), false);
  });
});
