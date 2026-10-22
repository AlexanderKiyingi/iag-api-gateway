import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import Fastify from "fastify";

test("the desk asks procurement at the path procurement serves", async () => {
  const seen: string[] = [];
  const server = createServer((req, res) => {
    seen.push(req.url ?? "");
    if (req.url !== "/api/v1/approvals/desk") {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end('{"items":[{"requisitionId":"REQ-1"}]}');
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };

  // The upstream map is read from env when routes.ts loads, so set it first.
  process.env.UPSTREAM_PROCUREMENT = `http://127.0.0.1:${port}`;
  const { registerApprovalsDesk } = await import("./approvals-desk.js");
  const app = Fastify();
  registerApprovalsDesk(app);

  try {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/approvals/desk",
      headers: { authorization: "Bearer t" },
    });
    const body = res.json();
    assert.deepEqual(seen, ["/api/v1/approvals/desk"]);
    assert.equal(body.partial, false);
    assert.equal(body.count, 1);
    assert.equal(body.items[0].source, "procurement");
  } finally {
    await app.close();
    server.close();
  }
});
