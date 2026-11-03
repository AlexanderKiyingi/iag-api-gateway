import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import Fastify from "fastify";
import httpProxy from "@fastify/http-proxy";
import { forwardResolvedClientIP } from "./forwarded.js";

test("the upstream sees the resolved client IP, not the one the caller wrote", async (t) => {
  let seen: http.IncomingHttpHeaders = {};
  const upstream = http.createServer((req, res) => {
    seen = req.headers;
    res.end("ok");
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  t.after(() => upstream.close());

  // One trusted hop, as in production behind Railway's edge.
  const gateway = Fastify({ trustProxy: 1 });
  await gateway.register(httpProxy, {
    upstream: `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`,
    prefix: "/svc",
    replyOptions: { rewriteRequestHeaders: forwardResolvedClientIP },
  });
  t.after(() => gateway.close());

  // The caller forges an entry; the edge appends the address it saw.
  const res = await gateway.inject({
    method: "GET",
    url: "/svc/x",
    headers: {
      "x-forwarded-for": "203.0.113.7, 41.210.1.1",
      forwarded: "for=203.0.113.7",
      "x-real-ip": "203.0.113.7",
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(seen["x-forwarded-for"], "41.210.1.1");
  assert.equal(seen["x-real-ip"], "41.210.1.1");
  assert.equal(seen.forwarded, undefined);
});
