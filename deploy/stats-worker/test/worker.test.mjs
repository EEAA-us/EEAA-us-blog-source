import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.mjs";

class MemoryD1 {
  posts = new Map([[7, { id: 7, slug: "hello", title: "Hello", views: 4, likes: 2 }]]);
  views = new Set(); likesByBrowser = new Set(); events = new Set();
  prepare(sql) {
    const db = this; let args = [];
    return { bind(...values) { args = values; return this; }, async first() {
      if (sql.startsWith("SELECT id,views,likes FROM posts")) return db.posts.get(args[0]) || null;
      return null;
    }, async run() {
      if (sql.startsWith("INSERT OR IGNORE INTO post_views")) {
        if (db.posts.has(args[2])) { const key = `${args[2]}:${args[0]}:${args[1]}`; if (!db.views.has(key)) { db.views.add(key); db.posts.get(args[2]).views++; } }
      }
      if (sql.startsWith("INSERT OR IGNORE INTO post_likes")) {
        const key = `${args[1]}:${args[0]}`; if (db.posts.has(args[1]) && !db.likesByBrowser.has(key)) { db.likesByBrowser.add(key); db.posts.get(args[1]).likes++; }
      }
      if (sql.startsWith("DELETE FROM post_likes")) {
        const key = `${args[0]}:${args[1]}`; if (db.likesByBrowser.delete(key)) db.posts.get(args[0]).likes = Math.max(0, db.posts.get(args[0]).likes - 1);
      }
      if (sql.startsWith("INSERT OR IGNORE INTO visitor_events")) db.events.add(args[0]);
      return { success: true };
    }, async all() { return { results: [] }; } };
  }
  async batch(stmts) { for (const stmt of stmts) await stmt.run(); }
}

const env = () => ({ DB: new MemoryD1(), BLOG_SERVICE_TOKEN: "service-secret", BLOG_ADMIN_TOKEN: "admin-secret" });
const req = (path, method, token, body) => new Request(`https://worker.test${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });

test("all statistics routes reject unauthenticated counter requests", async () => {
  const e = env();
  for (const path of ["/posts/7/stats", "/posts/7/view", "/posts/7/like", "/visitors/record", "/visitors/location"]) {
    const method = path.endsWith("/stats") || path.endsWith("/location") ? "GET" : "POST";
    assert.equal((await worker.fetch(req(path, method), e)).status, 401, path);
  }
});

test("view writes are session and Shanghai-day idempotent", async () => {
  const e = env(), body = { browserId: "browser-uuid-123456", sessionId: "session-uuid-123456" };
  const a = await worker.fetch(req("/posts/7/view", "POST", "service-secret", body), e);
  const b = await worker.fetch(req("/posts/7/view", "POST", "service-secret", body), e);
  assert.deepEqual(await a.json(), { views: 5, likes: 2 });
  assert.deepEqual(await b.json(), { views: 5, likes: 2 });
});

test("desired like state is idempotent and unlike preserves the seeded floor", async () => {
  const e = env(), body = { browserId: "browser-uuid-123456", liked: true };
  await worker.fetch(req("/posts/7/like", "POST", "service-secret", body), e);
  const twice = await worker.fetch(req("/posts/7/like", "POST", "service-secret", body), e);
  assert.deepEqual(await twice.json(), { likes: 3 });
  const unlike = await worker.fetch(req("/posts/7/unlike", "POST", "service-secret", { ...body, liked: false }), e);
  assert.deepEqual(await unlike.json(), { likes: 2 });
  await worker.fetch(req("/posts/7/unlike", "POST", "service-secret", { ...body, liked: false }), e);
  assert.equal((await e.DB.posts.get(7)).likes, 2);
});

test("visitor events deduplicate by UUID and reject browser supplied identity headers", async () => {
  const e = env(), body = { browserId: "browser-uuid-123456", sessionId: "session-uuid-123456", eventId: "event-uuid-123456", path: "/posts/hello" };
  await worker.fetch(req("/visitors/record", "POST", "service-secret", body), e);
  await worker.fetch(req("/visitors/record", "POST", "service-secret", body), e);
  assert.equal(e.DB.events.size, 1);
  const res = await worker.fetch(req("/posts/7/stats", "GET", "service-secret"), e);
  assert.deepEqual(await res.json(), { views: 4, likes: 2 });
});

test("location lookup requires the authenticated Next proxy IP header", async () => {
  const e = env();
  const missing = await worker.fetch(req("/visitors/location", "GET", "service-secret"), e);
  assert.equal(missing.status, 503);
  const invalidHeader = new Request("https://worker.test/visitors/location", { headers: { Authorization: "Bearer service-secret", "CF-Connecting-IP": "203.0.113.10" } });
  assert.equal((await worker.fetch(invalidHeader, e)).status, 503);
  const originalFetch = globalThis.fetch;
  let requestedIp;
  globalThis.fetch = async (input) => {
    requestedIp = new URL(input).searchParams.get("ip");
    return Response.json({ success: true, city: "Example City", region: "Example Region", country: "Example Country" });
  };
  try {
    const trusted = new Request("https://worker.test/visitors/location", { headers: { Authorization: "Bearer service-secret", "X-Stats-Visitor-IP": "203.0.113.22", "CF-Connecting-IP": "198.51.100.33" } });
    const response = await worker.fetch(trusted, e);
    assert.equal(response.status, 200);
    assert.equal(requestedIp, "203.0.113.22");
  } finally { globalThis.fetch = originalFetch; }
});
