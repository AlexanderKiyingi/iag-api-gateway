import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { acceptsQueryToken } from "./auth.js";

describe("acceptsQueryToken", () => {
  it("lifts ?token= for WebSocket upgrades", () => {
    assert.equal(acceptsQueryToken("GET", { upgrade: "websocket" }), true);
    assert.equal(acceptsQueryToken("GET", { upgrade: "WebSocket" }), true);
  });

  // EventSource cannot set headers either; without this the notifications
  // SSE stream answered 401 at the gateway for every browser.
  it("lifts ?token= for EventSource streams", () => {
    assert.equal(acceptsQueryToken("GET", { accept: "text/event-stream" }), true);
  });

  it("ignores ?token= on ordinary requests", () => {
    assert.equal(acceptsQueryToken("GET", { accept: "application/json" }), false);
    assert.equal(acceptsQueryToken("GET", {}), false);
    assert.equal(acceptsQueryToken("POST", { accept: "text/event-stream" }), false);
  });
});
