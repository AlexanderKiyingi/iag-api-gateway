import assert from "node:assert/strict";
import { test } from "node:test";
import { UsageRecorder, daysBetween, normalizeApp, serviceFromPath, usageFor } from "./usage.js";

test("serviceFromPath names the upstream a path is proxied to", () => {
  assert.equal(serviceFromPath("/api/v1/fleet/v1/trips"), "fleet");
  assert.equal(serviceFromPath("/api/v1/authentication/v1/users/me"), "authentication");
  assert.equal(serviceFromPath("/api/v1/usage"), null);
  assert.equal(serviceFromPath("/health"), null);
});

test("normalizeApp accepts short lowercase tool names only", () => {
  assert.equal(normalizeApp("iag-fleet"), "iag-fleet");
  assert.equal(normalizeApp(" IAG-HR "), "iag-hr");
  assert.equal(normalizeApp("bad\tname"), null);
  assert.equal(normalizeApp("x".repeat(41)), null);
  assert.equal(normalizeApp(undefined), null);
});

test("usageFor counts users, attributes by header or service, and skips machines", () => {
  const base = { method: "GET", url: "/api/v1/erp/v1/employees?limit=5", headers: {} as Record<string, string> };
  assert.deepEqual(usageFor({ ...base, auth: { sub: "u1", email: "a@b.c" } } as never), {
    userId: "u1",
    email: "a@b.c",
    app: "service:erp",
    service: "erp",
  });
  assert.equal(
    usageFor({ ...base, headers: { "x-iag-app": "iag-hr" }, auth: { sub: "u1" } } as never)?.app,
    "iag-hr",
  );
  assert.equal(usageFor({ ...base, auth: { sub: "svc", principal_type: "service" } } as never), null);
  assert.equal(usageFor({ ...base, auth: undefined } as never), null);
  assert.equal(usageFor({ ...base, method: "OPTIONS", auth: { sub: "u1" } } as never), null);
});

test("the recorder aggregates per day, user, app and service, and keeps the latest last-seen", async () => {
  const r = new UsageRecorder(undefined);
  const t = Date.parse("2026-10-03T08:00:00Z");
  r.record("u1", "a@b.c", "iag-fleet", "fleet", t);
  r.record("u1", "a@b.c", "iag-fleet", "fleet", t + 60_000);
  r.record("u1", "a@b.c", "iag-fleet", "erp", t + 120_000);
  r.record("u2", "", "service:erp", "erp", Date.parse("2026-10-02T23:59:00Z"));
  const rep = await r.report("2026-10-02", "2026-10-03");
  assert.equal(rep.storage, "memory");
  const fleet = rep.rows.find((x) => x.userId === "u1" && x.service === "fleet");
  assert.equal(fleet?.requests, 2);
  assert.equal(fleet?.email, "a@b.c");
  assert.equal(rep.rows.find((x) => x.userId === "u2")?.day, "2026-10-02");
  assert.equal(rep.lastSeen.u1?.["iag-fleet"], new Date(t + 120_000).toISOString());
  const none = await r.report("2026-10-04", "2026-10-05");
  assert.equal(none.rows.length, 0);
});

test("daysBetween is inclusive and empty for a reversed window", () => {
  assert.deepEqual(daysBetween("2026-09-30", "2026-10-02"), ["2026-09-30", "2026-10-01", "2026-10-02"]);
  assert.deepEqual(daysBetween("2026-10-02", "2026-09-30"), []);
});
