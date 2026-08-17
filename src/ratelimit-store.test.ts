import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Redis } from "ioredis";
import {
  createRateLimitStore,
  rateLimitBootMessage,
  type RedisClientFactory,
} from "./ratelimit-store.js";

function recorder() {
  const lines: Array<{ level: string; message: string }> = [];
  const record = (level: string) => (a: unknown, b?: unknown) => {
    lines.push({ level, message: String(typeof a === "string" ? a : (b ?? "")) });
  };
  return {
    lines,
    logger: { warn: record("warn"), info: record("info"), error: record("error") },
  };
}

/** A stand-in for ioredis. Real clients hold the event loop open retrying a
 *  connection, which would hang the test run; nothing here needs a live server. */
function fakeClient() {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
  return {
    listeners,
    client: {
      on(event: string, handler: (...args: unknown[]) => void) {
        (listeners[event] ??= []).push(handler);
        return this;
      },
    } as unknown as Redis,
  };
}

describe("rate-limit store selection", () => {
  it("stays in memory when REDIS_URL is unset", () => {
    const { logger } = recorder();
    const store = createRateLimitStore("", logger, () => {
      throw new Error("must not build a client without a URL");
    });
    assert.equal(store.mode, "in-memory");
    assert.equal(store.client, undefined);
  });

  it("treats whitespace as unset rather than as a host", () => {
    const { logger } = recorder();
    const store = createRateLimitStore("   ", logger, () => {
      throw new Error("must not build a client for whitespace");
    });
    assert.equal(store.mode, "in-memory");
  });

  it("shares one client with the limiter when a URL is configured", () => {
    const { logger } = recorder();
    const fake = fakeClient();
    let seenUrl = "";
    const factory: RedisClientFactory = (url) => {
      seenUrl = url;
      return fake.client;
    };

    const store = createRateLimitStore("redis://cache.internal:6379", logger, factory);

    assert.equal(store.mode, "redis");
    assert.equal(store.client, fake.client);
    assert.equal(seenUrl, "redis://cache.internal:6379");
  });

  it("attaches an error listener, because an unhandled one crashes the gateway", () => {
    const { logger, lines } = recorder();
    const fake = fakeClient();

    createRateLimitStore("redis://cache.internal:6379", logger, () => fake.client);

    const handlers = fake.listeners.error ?? [];
    assert.equal(handlers.length, 1, "exactly one error listener expected");

    // Node treats an 'error' event with no listener as a fatal exception. The
    // listener must log and let the gateway keep serving.
    handlers[0]?.(new Error("ECONNREFUSED"));
    assert.ok(
      lines.some((l) => l.level === "warn" && /uncounted/.test(l.message)),
      "a connection error should warn, not throw",
    );
  });

  it("falls back to memory instead of failing to boot when the client cannot be built", () => {
    const { logger, lines } = recorder();
    const store = createRateLimitStore("not-a-redis-url", logger, () => {
      throw new Error("invalid URL");
    });
    assert.equal(store.mode, "in-memory");
    assert.ok(lines.some((l) => l.level === "error"));
  });
});

describe("rate-limit boot message", () => {
  it("warns in production that in-memory counting breaks on a second replica", () => {
    const message = rateLimitBootMessage(
      { mode: "in-memory", reason: "REDIS_URL is unset; counters are per-instance" },
      true,
    );
    assert.equal(message.level, "warn");
    assert.match(message.message, /REDIS_URL/);
    assert.match(message.message, /one gateway instance/);
  });

  it("does not nag in development, where one instance is the whole truth", () => {
    const message = rateLimitBootMessage(
      { mode: "in-memory", reason: "REDIS_URL is unset; counters are per-instance" },
      false,
    );
    assert.equal(message.level, "info");
  });

  it("reports the shared budget when Redis is in use", () => {
    const message = rateLimitBootMessage(
      { mode: "redis", reason: "sharing one rate-limit budget across replicas" },
      true,
    );
    assert.equal(message.level, "info");
    assert.match(message.message, /Redis-backed/);
  });
});
