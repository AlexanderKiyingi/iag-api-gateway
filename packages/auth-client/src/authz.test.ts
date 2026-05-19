import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAccessDjangoAdmin,
  hasAnyPermission,
  isStaff,
  isSuperuser,
} from "./authz.js";

describe("django authz", () => {
  it("superuser bypasses permissions", () => {
    assert.equal(isSuperuser({ is_superuser: true }), true);
    assert.equal(
      hasAnyPermission({ is_superuser: true }, ["accounts.change_ledger"]),
      true,
    );
  });

  it("staff needs explicit codename", () => {
    const staff = { is_staff: true, groups: ["staff"], permissions: ["auth.view_user"] };
    assert.equal(isStaff(staff), true);
    assert.equal(hasAnyPermission(staff, ["auth.change_user"]), false);
    assert.equal(hasAnyPermission(staff, ["auth.view_user"]), true);
  });

  it("django admin access", () => {
    assert.equal(canAccessDjangoAdmin({ is_superuser: true }), true);
    assert.equal(canAccessDjangoAdmin({ is_staff: true, groups: ["staff"] }), false);
    assert.equal(canAccessDjangoAdmin({ is_staff: true, groups: ["admin"] }), true);
  });
});
