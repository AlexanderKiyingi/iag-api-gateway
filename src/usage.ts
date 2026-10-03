import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Redis } from "ioredis";
import { sendGatewayError } from "./errors.js";
import { upstreamRoutes } from "./routes.js";

/**
 * Tool utilisation: who uses which IAG tool, how much, and when they were
 * last seen.
 *
 * The gateway is the one place every tool's traffic passes through with a
 * verified identity attached (`request.auth`), so it counts there rather than
 * in sixteen frontends. Each authenticated, user-principal request adds one to
 * the counter for (day, user, app, service):
 *
 *   app      — the tool, from the `x-iag-app` header the frontends send
 *              ("iag-fleet", "iag-hr", …). Traffic without it is attributed
 *              to its service as "service:<name>", so nothing is lost while
 *              frontends are being tagged.
 *   service  — the upstream the request went to ("fleet", "erp", …).
 *
 * Counting is in-process and flushed every few seconds, so a request never
 * waits on storage. With REDIS_URL the counters land in Redis (shared by
 * replicas, kept RETENTION_DAYS); without it they live in this process and
 * reset on deploy, which `GET /api/v1/usage` reports as `storage: "memory"`.
 */

export const USAGE_RETENTION_DAYS = 120;
const FLUSH_INTERVAL_MS = 15_000;
const MEMORY_MAX_DAYS = 31;
const APP_HEADER = "x-iag-app";

const DAY_KEY = (day: string) => `usage:d:${day}`;
const LAST_SEEN_KEY = "usage:last";
const EMAIL_KEY = "usage:email";

export type UsageRow = {
  day: string;
  userId: string;
  email: string;
  app: string;
  service: string;
  requests: number;
};

export type UsageReport = {
  from: string;
  to: string;
  storage: "redis" | "memory";
  rows: UsageRow[];
  /** userId → app → ISO time of the most recent request. */
  lastSeen: Record<string, Record<string, string>>;
};

/** A tool name the frontends may send: lowercase, short, no separators we use. */
export function normalizeApp(raw: unknown): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,39}$/.test(v) ? v : null;
}

const SERVICE_PREFIXES = Object.values(upstreamRoutes)
  .map((r) => r.prefix.replace(/\/+$/, ""))
  .sort((a, b) => b.length - a.length);

/** The upstream a path is proxied to ("/api/v1/fleet/v1/trips" → "fleet"), or null. */
export function serviceFromPath(path: string): string | null {
  for (const prefix of SERVICE_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return prefix.split("/").filter(Boolean).pop() || null;
    }
  }
  return null;
}

export function dayOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Every UTC day from `from` to `to` inclusive (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return out;
  for (let t = start; t <= end && out.length <= USAGE_RETENTION_DAYS; t += 86_400_000) out.push(dayOf(t));
  return out;
}

const SEP = "\t";

export class UsageRecorder {
  /** day → field(user,app,service) → count, not yet flushed. */
  private pending = new Map<string, Map<string, number>>();
  private pendingLast = new Map<string, number>();
  private pendingEmail = new Map<string, string>();
  /** Memory-mode store (also what a failed flush falls back into). */
  private memory = new Map<string, Map<string, number>>();
  private memoryLast = new Map<string, number>();
  private memoryEmail = new Map<string, string>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly redis: Redis | undefined,
    private readonly log?: { warn: (obj: unknown, msg: string) => void },
  ) {}

  get storage(): "redis" | "memory" {
    return this.redis ? "redis" : "memory";
  }

  record(userId: string, email: string, app: string, service: string, at = Date.now()): void {
    const day = dayOf(at);
    const field = [userId, app, service].join(SEP);
    let bucket = this.pending.get(day);
    if (!bucket) this.pending.set(day, (bucket = new Map()));
    bucket.set(field, (bucket.get(field) || 0) + 1);
    const lastField = [userId, app].join(SEP);
    if ((this.pendingLast.get(lastField) || 0) < at) this.pendingLast.set(lastField, at);
    if (email) this.pendingEmail.set(userId, email);
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
    this.timer.unref();
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.flush();
  }

  async flush(): Promise<void> {
    if (!this.pending.size && !this.pendingLast.size) return;
    const pending = this.pending;
    const last = this.pendingLast;
    const emails = this.pendingEmail;
    this.pending = new Map();
    this.pendingLast = new Map();
    this.pendingEmail = new Map();

    if (this.redis) {
      try {
        const tx = this.redis.multi();
        for (const [day, bucket] of pending) {
          for (const [field, n] of bucket) tx.hincrby(DAY_KEY(day), field, n);
          tx.expire(DAY_KEY(day), USAGE_RETENTION_DAYS * 86_400);
        }
        // Last-seen only moves forward: a slower replica must not rewind it.
        for (const [field, at] of last) {
          tx.eval(
            "local c = tonumber(redis.call('HGET', KEYS[1], ARGV[1]) or '0'); if tonumber(ARGV[2]) > c then redis.call('HSET', KEYS[1], ARGV[1], ARGV[2]) end; return 1",
            1,
            LAST_SEEN_KEY,
            field,
            String(at),
          );
        }
        for (const [userId, email] of emails) tx.hset(EMAIL_KEY, userId, email);
        await tx.exec();
        return;
      } catch (err) {
        // Keep the counts rather than drop them; they are merged into memory
        // and the report will still show them until the process restarts.
        this.log?.warn({ err }, "usage flush to Redis failed; keeping counts in memory");
      }
    }
    this.mergeIntoMemory(pending, last, emails);
  }

  private mergeIntoMemory(
    pending: Map<string, Map<string, number>>,
    last: Map<string, number>,
    emails: Map<string, string>,
  ): void {
    for (const [day, bucket] of pending) {
      let target = this.memory.get(day);
      if (!target) this.memory.set(day, (target = new Map()));
      for (const [field, n] of bucket) target.set(field, (target.get(field) || 0) + n);
    }
    for (const [field, at] of last) {
      if ((this.memoryLast.get(field) || 0) < at) this.memoryLast.set(field, at);
    }
    for (const [userId, email] of emails) this.memoryEmail.set(userId, email);
    // Bound memory mode: drop the oldest days.
    const days = [...this.memory.keys()].sort();
    while (days.length > MEMORY_MAX_DAYS) this.memory.delete(days.shift()!);
  }

  async report(from: string, to: string): Promise<UsageReport> {
    // Include counts not yet flushed, so a report right after use is current.
    await this.flush();
    const days = daysBetween(from, to);
    const buckets: Array<[string, Record<string, string>]> = [];
    let lastRaw: Record<string, string> = {};
    let emails: Record<string, string> = {};

    if (this.redis) {
      try {
        const tx = this.redis.multi();
        for (const day of days) tx.hgetall(DAY_KEY(day));
        tx.hgetall(LAST_SEEN_KEY);
        tx.hgetall(EMAIL_KEY);
        const results = (await tx.exec()) || [];
        days.forEach((day, i) => buckets.push([day, (results[i]?.[1] as Record<string, string>) || {}]));
        lastRaw = (results[days.length]?.[1] as Record<string, string>) || {};
        emails = (results[days.length + 1]?.[1] as Record<string, string>) || {};
      } catch (err) {
        this.log?.warn({ err }, "usage read from Redis failed; reporting in-memory counts only");
      }
    }
    // Memory-mode counts (and anything a failed flush kept) are added in.
    for (const day of days) {
      const bucket = this.memory.get(day);
      if (!bucket) continue;
      const rec: Record<string, string> = {};
      for (const [field, n] of bucket) rec[field] = String(n);
      buckets.push([day, rec]);
    }
    for (const [field, at] of this.memoryLast) {
      if (Number(lastRaw[field] || 0) < at) lastRaw[field] = String(at);
    }
    for (const [userId, email] of this.memoryEmail) emails[userId] ||= email;

    const merged = new Map<string, UsageRow>();
    for (const [day, rec] of buckets) {
      for (const [field, value] of Object.entries(rec)) {
        const [userId = "", app = "", service = ""] = field.split(SEP);
        const key = [day, field].join(SEP);
        const row = merged.get(key) || { day, userId, email: emails[userId] || "", app, service, requests: 0 };
        row.requests += Number(value) || 0;
        merged.set(key, row);
      }
    }

    const lastSeen: UsageReport["lastSeen"] = {};
    for (const [field, at] of Object.entries(lastRaw)) {
      const [userId = "", app = ""] = field.split(SEP);
      (lastSeen[userId] ||= {})[app] = new Date(Number(at)).toISOString();
    }

    return {
      from,
      to,
      storage: this.storage,
      rows: [...merged.values()].sort((a, b) => a.day.localeCompare(b.day) || b.requests - a.requests),
      lastSeen,
    };
  }
}

/** Whether a finished request should be counted, and as what. */
export function usageFor(
  request: Pick<FastifyRequest, "url" | "method" | "headers" | "auth">,
): { userId: string; email: string; app: string; service: string } | null {
  const principal = request.auth;
  if (!principal?.sub) return null;
  // Service-to-service calls (client_credentials) are machines, not people.
  if ((principal as { principal_type?: string }).principal_type === "service") return null;
  if (request.method === "OPTIONS") return null;
  const path = request.url.split("?")[0] ?? request.url;
  const service = serviceFromPath(path);
  if (!service) return null;
  const app = normalizeApp(request.headers[APP_HEADER]) || `service:${service}`;
  return { userId: principal.sub, email: String(principal.email || ""), app, service };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Hooks the recorder onto every response and serves the admin report:
 *
 *   GET /api/v1/usage?from=YYYY-MM-DD&to=YYYY-MM-DD   (admin only, see policies.ts)
 *
 * Defaults to the last 30 days; a window is capped at USAGE_RETENTION_DAYS.
 */
export function registerUsage(app: FastifyInstance, redis: Redis | undefined): UsageRecorder {
  const recorder = new UsageRecorder(redis, app.log);
  recorder.start();
  app.addHook("onResponse", async (request: FastifyRequest, _reply: FastifyReply) => {
    const hit = usageFor(request);
    if (hit) recorder.record(hit.userId, hit.email, hit.app, hit.service);
  });
  app.addHook("onClose", async () => {
    await recorder.stop();
  });

  app.get("/api/v1/usage", async (request, reply) => {
    const q = request.query as { from?: string; to?: string };
    const today = dayOf(Date.now());
    const to = q.to && DATE.test(q.to) ? q.to : today;
    const from = q.from && DATE.test(q.from) ? q.from : dayOf(Date.parse(`${to}T00:00:00Z`) - 29 * 86_400_000);
    if (daysBetween(from, to).length === 0) {
      return sendGatewayError(reply, 400, "BAD_REQUEST", "from must be on or before to");
    }
    return recorder.report(from, to);
  });
  return recorder;
}
