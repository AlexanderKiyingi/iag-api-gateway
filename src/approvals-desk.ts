import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { upstreamRoutes } from "./routes.js";

/**
 * Cross-domain approval desk.
 *
 * Desk chains are a shared library rather than a service, so each domain owns
 * its own queue: procurement answers for requisitions, and further services as
 * they adopt the engine. That is the right ownership boundary — the requests
 * live where their data lives — but it leaves an approver checking one desk per
 * system, which is exactly the friction desk chains exist to remove.
 *
 * This route restores the single queue by fanning out to each participating
 * upstream with the caller's own token and merging the answers. It aggregates
 * only; every authorization decision, including which desks the caller holds
 * and the four-eyes rule, stays with the service that owns the request.
 */

/**
 * Upstreams that expose a desk, and the path each serves it at. The path is the
 * service's own route, after the gateway prefix is stripped: procurement
 * mounts its API under /api/v1, so its desk is /api/v1/approvals/desk.
 */
const DESK_SOURCES: ReadonlyArray<{ prefix: string; path: string }> = [
  { prefix: "/api/v1/procurement", path: "/api/v1/approvals/desk" },
];

/** A slow or dead upstream must not hold the whole queue hostage. */
const FANOUT_TIMEOUT_MS = Number(process.env.APPROVALS_DESK_TIMEOUT_MS ?? 4000);

interface DeskItem {
  requisitionId?: string;
  title?: string;
  [key: string]: unknown;
}

interface SourceResult {
  source: string;
  items: DeskItem[];
  ok: boolean;
  error?: string;
}

async function fetchDesk(prefix: string, path: string, authorization: string): Promise<SourceResult> {
  const route = upstreamRoutes[prefix];
  const source = prefix.replace("/api/v1/", "");
  if (!route) {
    return { source, items: [], ok: false, error: "upstream not configured" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FANOUT_TIMEOUT_MS);
  try {
    const base = route.upstream.replace(/\/$/, "");
    const rewrite = route.rewritePrefix === "/" ? "" : route.rewritePrefix;
    const res = await fetch(`${base}${rewrite}${path}`, {
      headers: { authorization, accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      return { source, items: [], ok: false, error: `upstream returned ${res.status}` };
    }
    const body = (await res.json()) as { items?: DeskItem[] };
    const items = (body.items ?? []).map((item) => ({ ...item, source }));
    return { source, items, ok: true };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      source,
      items: [],
      ok: false,
      error: aborted ? `timed out after ${FANOUT_TIMEOUT_MS}ms` : "unreachable",
    };
  } finally {
    clearTimeout(timer);
  }
}

export function registerApprovalsDesk(app: FastifyInstance): void {
  app.get(
    "/api/v1/approvals/desk",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authorization = request.headers.authorization;
      if (!authorization) {
        return reply.code(401).send({ error: "Sign in required" });
      }

      const results = await Promise.all(
        DESK_SOURCES.map(({ prefix, path }) => fetchDesk(prefix, path, authorization)),
      );

      const items = results.flatMap((r) => r.items);
      // A partial answer is reported as partial rather than passed off as the
      // whole queue: an approver who cannot see a pending request because one
      // service was down should be told, not left to assume they are clear.
      const degraded = results.filter((r) => !r.ok);

      return reply.send({
        items,
        count: items.length,
        sources: results.map(({ source, ok, error, items: sourceItems }) => ({
          source,
          ok,
          count: sourceItems.length,
          ...(error ? { error } : {}),
        })),
        partial: degraded.length > 0,
      });
    },
  );
}
