import { Redis } from "ioredis";
import type { FastifyBaseLogger } from "fastify";

/**
 * Shared rate-limit state.
 *
 * The limiter's counters live in the process by default, which is right for one
 * instance and wrong for two: each replica keeps its own budget, so the
 * effective limit multiplies by the replica count and a single user's requests
 * are counted in whichever bucket the edge happened to route them to. Redis
 * gives every replica one budget to draw down.
 *
 * This is deliberately optional. The gateway must keep serving when Redis is
 * absent or unreachable — an unavailable rate limiter is a reason to stop
 * counting, never a reason to stop answering requests.
 */

/** How the limiter is keeping count, for logging and for tests. */
export type RateLimitMode = "redis" | "in-memory";

export interface RateLimitStore {
  mode: RateLimitMode;
  /** Passed to @fastify/rate-limit as its `redis` option; undefined = memory. */
  client?: Redis;
  /** Why this mode was chosen, for the boot log. */
  reason: string;
}

/**
 * Build the ioredis client the limiter should share, or none.
 *
 * The connection options matter more than the connection here:
 *
 *   - `enableOfflineQueue: false` makes commands fail immediately while
 *     disconnected instead of queueing. Queued commands would hold requests
 *     open waiting for a Redis that may never return, turning a limiter outage
 *     into a gateway outage.
 *   - `maxRetriesPerRequest: 1` bounds how long a single command can spend
 *     retrying, for the same reason.
 *   - `lazyConnect: false` so connection problems surface in the boot logs
 *     rather than on the first user request.
 *
 * Paired with `skipOnError: true` on the limiter itself, a Redis failure means
 * requests pass uncounted rather than 500. That is failing open, and it is the
 * right trade for this component: the limiter protects against volume, and
 * dropping every request during a Redis blip would cause the outage it exists
 * to prevent. It does mean a sustained Redis outage leaves the platform
 * unthrottled, so the boot log says so plainly.
 */
export type RedisClientFactory = (url: string) => Redis;

/** The real client. Separated so tests can exercise the selection logic and the
 *  error-listener contract without opening a socket. */
export const defaultRedisFactory: RedisClientFactory = (url) =>
  new Redis(url, {
    connectionName: "iag-gateway-ratelimit",
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 5_000,
  });

export function createRateLimitStore(
  redisUrl: string,
  logger: Pick<FastifyBaseLogger, "warn" | "info" | "error">,
  createClient: RedisClientFactory = defaultRedisFactory,
): RateLimitStore {
  const url = redisUrl.trim();
  if (url === "") {
    return {
      mode: "in-memory",
      reason: "REDIS_URL is unset; counters are per-instance",
    };
  }

  try {
    const client = createClient(url);

    // An error event with no listener is an unhandled exception in Node, which
    // would take the gateway down for the one dependency it is meant to
    // survive without.
    client.on("error", (err: Error) => {
      logger.warn(
        { err: err.message },
        "rate-limit Redis error; requests pass uncounted until it recovers",
      );
    });

    return {
      mode: "redis",
      client,
      reason: "sharing one rate-limit budget across replicas",
    };
  } catch (err) {
    // A malformed URL should not stop the gateway booting. Degrade to memory
    // and say so — per-instance counting beats no gateway.
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      "REDIS_URL could not be parsed; falling back to in-memory rate limiting",
    );
    return {
      mode: "in-memory",
      reason: "REDIS_URL was unusable",
    };
  }
}

/**
 * The boot message for a given store, including the warning that matters:
 * in-memory counting is only correct at one replica, and nothing in the process
 * can detect that a second one has started.
 */
export function rateLimitBootMessage(
  store: RateLimitStore,
  isProduction: boolean,
): { level: "info" | "warn"; message: string } {
  if (store.mode === "redis") {
    return {
      level: "info",
      message: `rate limiting is Redis-backed — ${store.reason}`,
    };
  }
  if (isProduction) {
    return {
      level: "warn",
      message:
        `rate limiting is in-memory (${store.reason}). This is only correct while exactly ` +
        `one gateway instance runs: every additional replica adds a full extra limit, and ` +
        `nothing here can detect that. Set REDIS_URL before scaling out.`,
    };
  }
  return {
    level: "info",
    message: `rate limiting is in-memory — ${store.reason}`,
  };
}
