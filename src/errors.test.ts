import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isUpstreamConnectionError,
  upstreamUnavailableMessage,
} from "./errors.js";

describe("gateway upstream errors", () => {
  it("detects connection refused as upstream failure", () => {
    assert.equal(isUpstreamConnectionError({ code: "ECONNREFUSED" }), true);
    assert.equal(isUpstreamConnectionError({ code: "VALIDATION" }), false);
    assert.equal(
      isUpstreamConnectionError({ cause: { code: "ECONNREFUSED" } }),
      true,
    );
  });

  it("maps authentication upstream to a clear message", () => {
    assert.equal(
      upstreamUnavailableMessage("/api/v1/authentication"),
      "Authentication service is unavailable",
    );
  });
});
