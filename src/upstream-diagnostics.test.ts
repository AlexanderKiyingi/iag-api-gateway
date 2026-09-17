import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { probeUpstream } from "./upstream-diagnostics.js";

test("a reachable upstream reports its status and the host:port dialed", async () => {
  const server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end('{"status":"ok"}');
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  try {
    const probe = await probeUpstream("/api/v1/x", `http://127.0.0.1:${port}`, "UPSTREAM_X");
    assert.equal(probe.ok, true);
    assert.equal(probe.status, 200);
    assert.deepEqual(probe.target, { host: "127.0.0.1", port: String(port) });
  } finally {
    server.close();
  }
});

test("a closed port is reported as ECONNREFUSED, not a bare 'unavailable'", async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const probe = await probeUpstream("/api/v1/x", `http://127.0.0.1:${port}`, "UPSTREAM_X");
  assert.equal(probe.ok, false);
  assert.equal(probe.error, "ECONNREFUSED");
});

test("an unknown host is reported as a DNS failure", async () => {
  const probe = await probeUpstream("/api/v1/x", "http://no-such-service.railway.internal:4002", "UPSTREAM_X");
  assert.equal(probe.ok, false);
  assert.match(probe.error ?? "", /ENOTFOUND|EAI_AGAIN|timed out/);
  assert.equal(probe.target.port, "4002");
});
