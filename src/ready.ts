import type { ReadyCheckResult } from "@iag/service-core";
import { upstreamRoutes } from "./routes.js";

const PROBE_TIMEOUT_MS = 2_500;

export function createReadyCheck(enabled: boolean): () => Promise<ReadyCheckResult> {
  return async () => {
    if (!enabled) {
      return { status: "ready" };
    }

    const checks: ReadyCheckResult["checks"] = {};
    const entries = Object.entries(upstreamRoutes);

    await Promise.all(
      entries.map(async ([name, route]) => {
        const url = new URL("/ready", route.upstream);
        try {
          const res = await fetch(url, {
            signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
          });
          checks[name] = {
            ok: res.ok,
            detail: res.ok ? undefined : `HTTP ${res.status}`,
          };
        } catch (err) {
          checks[name] = {
            ok: false,
            detail: err instanceof Error ? err.message : "probe failed",
          };
        }
      }),
    );

    const values = Object.values(checks);
    const allOk = values.every((c) => c.ok);
    const anyOk = values.some((c) => c.ok);

    if (allOk) return { status: "ready", checks };
    if (anyOk) return { status: "degraded", checks };
    return { status: "not_ready", checks };
  };
}
