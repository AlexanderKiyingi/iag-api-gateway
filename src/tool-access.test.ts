import assert from "node:assert/strict";
import { test } from "node:test";
import { blockedTool, toolBlockGroup } from "./tool-access.js";

test("toolBlockGroup maps an app to its block group", () => {
  assert.equal(toolBlockGroup("iag-fleet"), "no-access-fleet");
  assert.equal(toolBlockGroup("iag-farmer-traceability"), "no-access-farmer-traceability");
});

test("a member of no-access-<tool> is blocked from that tool only", () => {
  const p = { sub: "u1", groups: ["user", "no-access-fleet"] };
  assert.equal(blockedTool(p, "iag-fleet"), "iag-fleet");
  assert.equal(blockedTool(p, "iag-hr"), null);
});

test("the roles claim alias is honoured and matching ignores case", () => {
  assert.equal(blockedTool({ sub: "u1", roles: ["No-Access-HR"] }, "IAG-HR"), "iag-hr");
});

test("superusers are never blocked, and untagged requests are not tool traffic", () => {
  assert.equal(blockedTool({ sub: "s", is_superuser: true, groups: ["no-access-fleet"] }, "iag-fleet"), null);
  assert.equal(blockedTool({ sub: "u1", groups: ["no-access-fleet"] }, undefined), null);
  assert.equal(blockedTool({ sub: "u1", groups: ["no-access-fleet"] }, "not a valid name!"), null);
});
