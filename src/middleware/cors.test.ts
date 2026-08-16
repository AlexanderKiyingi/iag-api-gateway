import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { corsHasWildcard, parseCORSOrigins } from "./cors.js";

describe("parseCORSOrigins", () => {
  it("reads the canonical key first, then the legacy ones", () => {
    assert.deepEqual(
      parseCORSOrigins({ CORS_ALLOWED_ORIGINS: "https://a.example", CORS_ORIGIN: "https://b.example" }),
      ["https://a.example"],
    );
    assert.deepEqual(parseCORSOrigins({ CORS_ORIGIN: "https://b.example" }), ["https://b.example"]);
  });

  // A browser Origin header is scheme://host[:port] and never carries a
  // trailing slash, so an allowlist entry pasted from an address bar silently
  // fails to match and reads as "CORS is broken for that one app".
  it("normalises trailing slashes so pasted URLs still match", () => {
    assert.deepEqual(
      parseCORSOrigins({ CORS_ORIGIN: "https://dmsiag.vercel.app/,https://crmtooliag.vercel.app" }),
      ["https://dmsiag.vercel.app", "https://crmtooliag.vercel.app"],
    );
  });

  it("tolerates the whitespace and newlines multi-line env values pick up", () => {
    assert.deepEqual(
      parseCORSOrigins({ CORS_ORIGIN: " https://a.example , https://b.example \n" }),
      ["https://a.example", "https://b.example"],
    );
  });

  it("drops empty entries from a trailing comma", () => {
    assert.deepEqual(parseCORSOrigins({ CORS_ORIGIN: "https://a.example,," }), ["https://a.example"]);
  });

  it("passes a wildcard through untouched", () => {
    assert.deepEqual(parseCORSOrigins({ CORS_ORIGIN: "*" }), ["*"]);
    assert.equal(corsHasWildcard(parseCORSOrigins({ CORS_ORIGIN: "*" })), true);
  });

  it("falls back to localhost when nothing is configured", () => {
    assert.deepEqual(parseCORSOrigins({}), ["http://localhost:3000", "http://localhost:5173"]);
  });
});
