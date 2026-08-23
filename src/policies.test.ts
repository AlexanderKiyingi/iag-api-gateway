import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isProxiedPath } from "./routes.js";
import { matchPolicy } from "./policies.js";
import { PLATFORM_ACCESS, erpMutatePermissions, erpViewPermissions, mesAdminWritePermissions, mesMutatePermissions, mesViewPermissions, productionAdminWritePermissions, productionMutatePermissions, productionViewPermissions, scmViewPermissions } from "./service-permissions.js";

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

  // These two lists are an any-of pre-filter: a caller holding none of the
  // codenames is refused here, before iag-erp's own RequirePermission runs. A
  // codename the service enforces but the gateway omits therefore makes that
  // whole module unreachable for the role that owns it — which is what had
  // happened to payroll, compensation, recruitment, lifecycle, performance,
  // disciplinary, training and the HR record store.
  //
  // Source of truth: iag-erp internal/models/permissions.go,
  // PermissionDescriptors(). Update both together.
  const ERP_SERVICE_CATALOGUE = [
    "erp.view_hr_overview",
    "erp.view_employee",
    "erp.change_employee",
    "erp.view_leave",
    "erp.change_leave",
    "erp.approve_leave",
    "erp.view_attendance",
    "erp.change_attendance",
    "erp.view_all_hr",
    "erp.view_compensation",
    "erp.change_compensation",
    "erp.view_payslip",
    "erp.view_payroll",
    "erp.run_payroll",
    "erp.approve_payroll",
    "erp.post_payroll",
    "erp.view_recruitment",
    "erp.change_recruitment",
    "erp.view_lifecycle",
    "erp.change_lifecycle",
    "erp.complete_checklist_item",
    "erp.view_performance",
    "erp.change_performance",
    "erp.manage_performance",
    "erp.view_disciplinary",
    "erp.change_disciplinary",
    "erp.view_training",
    "erp.change_training",
    "erp.view_hr_records",
    "erp.change_hr_records",
    "erp.view_production_order",
    "erp.change_production_order",
  ];

  it("admits every erp permission the service enforces", () => {
    const gated = new Set([
      ...erpViewPermissions,
      ...erpMutatePermissions,
      // Admin-only codenames have their own narrower policy on /admin.
      "erp.admin.read",
    ]);
    const unreachable = ERP_SERVICE_CATALOGUE.filter((p) => !gated.has(p));
    assert.deepEqual(
      unreachable,
      [],
      `iag-erp enforces these but the gateway admits nobody holding only them: ${unreachable.join(", ")}`,
    );
  });

  it("does not gate erp routes on codenames the service never registers", () => {
    const registered = new Set(ERP_SERVICE_CATALOGUE);
    const unknown = [...erpViewPermissions, ...erpMutatePermissions].filter(
      (p) => !registered.has(p),
    );
    assert.deepEqual(
      unknown,
      [],
      `Not in iag-erp's PermissionDescriptors(): ${unknown.join(", ")}`,
    );
  });

  it("matches erp view permissions on ERP GET API", () => {
    const policy = matchPolicy("/api/v1/erp/api/v1/employees", "GET");
    assert.deepEqual(policy?.permissions, erpViewPermissions);
    assert.deepEqual(policy?.requireAllPermissions, [PLATFORM_ACCESS.erp]);
  });

  it("matches erp mutate permissions on ERP POST API", () => {
    const policy = matchPolicy("/api/v1/erp/api/v1/payroll/runs", "POST");
    assert.deepEqual(policy?.permissions, erpMutatePermissions);
    assert.deepEqual(policy?.requireAllPermissions, [PLATFORM_ACCESS.erp]);
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
