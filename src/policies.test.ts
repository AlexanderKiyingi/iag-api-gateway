import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isProxiedPath } from "./routes.js";
import { matchPolicy } from "./policies.js";
import { PLATFORM_ACCESS, scmViewPermissions } from "./service-permissions.js";

describe("gateway policies", () => {
  it("proxied paths without policy are identifiable", () => {
    assert.equal(isProxiedPath("/api/v1/accounts/v1/ledgers"), true);
    assert.equal(isProxiedPath("/health"), false);
    assert.equal(isProxiedPath("/api/v1"), false);
  });

  it("matches public health on reports", () => {
    const policy = matchPolicy("/api/v1/reports/health", "GET");
    assert.equal(policy?.public, true);
  });

  it("matches permission on reports API", () => {
    const policy = matchPolicy("/api/v1/reports/v1/summary", "GET");
    assert.deepEqual(policy?.permissions, ["reports.view_report"]);
  });

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

  it("allows self profile without platform.access_users", () => {
    const policy = matchPolicy("/api/v1/users/v1/me/profile", "GET");
    assert.equal(policy?.authenticated, true);
    assert.equal(policy?.requireAllPermissions, undefined);
  });
});
