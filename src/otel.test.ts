import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { samplerFromEnv } from "./otel.js";

/**
 * The gateway is the one process every request passes through, so its sampling
 * decision is the platform's trace volume. These cases pin the two properties
 * that matter: an unset environment must not mean "trace everything", and a
 * malformed setting must degrade toward more traces rather than none.
 */
describe("samplerFromEnv", () => {
  it("samples a fraction by default rather than everything", () => {
    const s = samplerFromEnv({});
    assert.match(s.toString(), /TraceIdRatioBased\{0\.1\}/);
  });

  it("honours an explicit ratio", () => {
    const s = samplerFromEnv({
      OTEL_TRACES_SAMPLER: "parentbased_traceidratio",
      OTEL_TRACES_SAMPLER_ARG: "0.25",
    });
    assert.match(s.toString(), /TraceIdRatioBased\{0\.25\}/);
  });

  it("supports always_on for a deliberate full-trace window", () => {
    const s = samplerFromEnv({ OTEL_TRACES_SAMPLER: "always_on" });
    assert.match(s.toString(), /AlwaysOnSampler/);
  });

  for (const arg of ["", "  ", "abc", "-1", "2", "NaN"]) {
    it(`falls back to the default ratio for a bad arg ${JSON.stringify(arg)}`, () => {
      const s = samplerFromEnv({
        OTEL_TRACES_SAMPLER: "parentbased_traceidratio",
        OTEL_TRACES_SAMPLER_ARG: arg,
      });
      // Never zero: a typo in a deploy variable must not silently switch
      // tracing off, which is the failure nobody notices until they need it.
      assert.match(s.toString(), /TraceIdRatioBased\{0\.1\}/);
    });
  }

  it("falls back to the default for an unrecognised sampler name", () => {
    const s = samplerFromEnv({ OTEL_TRACES_SAMPLER: "jaeger_remote" });
    assert.match(s.toString(), /TraceIdRatioBased\{0\.1\}/);
  });

  it("is parent-based in every case, so a trace is never half-recorded", () => {
    for (const env of [
      {},
      { OTEL_TRACES_SAMPLER: "always_on" },
      { OTEL_TRACES_SAMPLER: "traceidratio", OTEL_TRACES_SAMPLER_ARG: "0.5" },
      { OTEL_TRACES_SAMPLER: "nonsense" },
    ]) {
      assert.match(samplerFromEnv(env).toString(), /ParentBased/);
    }
  });
});
