/**
 * Every permission iag-production registers must be reachable through this
 * gateway.
 *
 * The lists in service-permissions.ts are an any-of pre-filter: a caller
 * holding none of the codenames in them is refused at the edge, before the
 * service's own RequirePermission runs. So a list that lags the service does
 * not merely under-document — it makes part of the service unreachable for the
 * roles that own it. That is already written on the ERP lists in that file,
 * after a payroll officer was refused a service that would have served them.
 *
 * It happened again here. iag-production gates every master write on
 * `production.change_config`, and every master read on `view_run OR
 * view_config`, and neither codename was in any list — so no caller could
 * write a product, machine, operator, shift, grade or reason code, and a
 * configurator holding view_config without view_run could not read one. A
 * superadmin was unaffected because it also holds add_run, which is why this
 * survived: the only account anyone tested with could not see it.
 *
 * The service's own PermissionDescriptors() is the source of truth, so this
 * reads it rather than restating it. That file lives in a sibling repo, present
 * when this runs inside the monorepo and absent when the gateway is checked out
 * on its own — so the comparison guards in the first case and is skipped in the
 * second, rather than failing for a reason that has nothing to do with the
 * gateway. The last case holds either way.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  productionViewPermissions,
  productionMutatePermissions,
  productionAdminWritePermissions,
} from "./service-permissions.js";
import { routePolicies } from "./policies.js";

const SERVICE_PERMISSIONS = join(
  process.cwd(),
  "../../../services/operations/production/internal/models/permissions.go",
);

function registeredCodenames(): string[] | null {
  let body: string;
  try {
    body = readFileSync(SERVICE_PERMISSIONS, "utf8");
  } catch {
    return null; // gateway checked out standalone — nothing to compare against
  }
  const found = body.match(/"production\.[a-z_.]+"/g) ?? [];
  return [...new Set(found.map((s) => s.slice(1, -1)))].sort();
}

/** Codenames this gateway will accept, from the lists and from inline policies. */
function acceptedCodenames(): Set<string> {
  const out = new Set<string>([
    ...productionViewPermissions,
    ...productionMutatePermissions,
    ...productionAdminWritePermissions,
  ]);
  // Some prefixes name their permissions inline rather than through a list.
  for (const policy of routePolicies) {
    if (!policy.prefix.startsWith("/api/v1/production")) continue;
    for (const p of policy.permissions ?? []) out.add(p);
    for (const p of policy.requireAllPermissions ?? []) out.add(p);
  }
  return out;
}

describe("production permission coverage", () => {
  const registered = registeredCodenames();

  it("accepts every codename the service registers", (t) => {
    if (registered === null) {
      t.skip("iag-production is not checked out beside this repo");
      return;
    }
    const accepted = acceptedCodenames();
    const unreachable = registered.filter((c) => !accepted.has(c));
    assert.deepEqual(
      unreachable,
      [],
      "registered by iag-production and refused at this gateway, so the roles " +
        `that hold them cannot reach the service: ${unreachable.join(", ")}`,
    );
  });

  it("names no codename the service does not register", (t) => {
    if (registered === null) {
      t.skip("iag-production is not checked out beside this repo");
      return;
    }
    // The other direction is a typo or a rename left behind. Not a security
    // hole — the service refuses it regardless — but a list that has stopped
    // describing anything.
    const stale = [...acceptedCodenames()]
      .filter((c) => c.startsWith("production."))
      .filter((c) => !registered.includes(c));
    assert.deepEqual(
      stale,
      [],
      `not registered by iag-production: ${stale.join(", ")}`,
    );
  });

  it("guards the two codenames this test was added for", () => {
    // Explicit, so the guard still says something when the sibling repo is
    // absent and both cases above skip.
    assert.ok(
      productionMutatePermissions.includes("production.change_config"),
      "every master write in iag-production is gated on change_config",
    );
    assert.ok(
      productionViewPermissions.includes("production.view_config"),
      "a configurator holding view_config without view_run must be able to read masters",
    );
  });
});
