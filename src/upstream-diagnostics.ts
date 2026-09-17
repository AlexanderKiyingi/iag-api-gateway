import type { FastifyInstance } from "fastify";
import { upstreamRoutes } from "./routes.js";

const PROBE_TIMEOUT_MS = 2_500;

export type UpstreamProbe = {
  prefix: string;
  envKey: string;
  /** Host and port the gateway dials, so a wrong variable is visible as such. */
  target: { host: string; port: string };
  ok: boolean;
  status?: number;
  /** Node's dial error code (ENOTFOUND, ECONNREFUSED, …) or a timeout. */
  error?: string;
  ms: number;
};

/** Dial one upstream's /health and say exactly how it failed if it did. */
export async function probeUpstream(prefix: string, upstream: string, envKey: string): Promise<UpstreamProbe> {
  const url = new URL("/health", upstream);
  const started = Date.now();
  const base = {
    prefix,
    envKey,
    target: { host: url.hostname, port: url.port || (url.protocol === "https:" ? "443" : "80") },
  };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    return { ...base, ok: res.ok, status: res.status, ms: Date.now() - started };
  } catch (err) {
    return { ...base, ok: false, error: describeDialError(err), ms: Date.now() - started };
  }
}

function describeDialError(err: unknown): string {
  if (!(err instanceof Error)) return "probe failed";
  if (err.name === "TimeoutError" || err.name === "AbortError") return `timed out after ${PROBE_TIMEOUT_MS}ms`;
  const cause = (err as Error & { cause?: { code?: string; message?: string } }).cause;
  if (cause?.code) return cause.code;
  return cause?.message || err.message;
}

/**
 * GET /api/v1/upstreams — every configured upstream, dialed once, with the
 * host and port the gateway actually used and the dial error when it failed.
 *
 * Proxy errors say "Upstream service is unavailable" and nothing else, which
 * on the day the variables were first set left no way to tell a wrong
 * hostname from a wrong port from a service that was not running. /ready can
 * probe upstreams, but enabling that takes the gateway out of rotation when
 * any one of them is down, so it stays off in production. This answers the
 * same question on demand, gated on admin, without touching readiness.
 */
export function registerUpstreamDiagnostics(app: FastifyInstance): void {
  app.get("/api/v1/upstreams", async () => {
    const probes = await Promise.all(
      Object.values(upstreamRoutes).map((route) => probeUpstream(route.prefix, route.upstream, route.envKey)),
    );
    probes.sort((a, b) => a.prefix.localeCompare(b.prefix));
    return {
      checkedAt: new Date().toISOString(),
      ok: probes.filter((p) => p.ok).length,
      failing: probes.filter((p) => !p.ok).length,
      upstreams: probes,
    };
  });
}
