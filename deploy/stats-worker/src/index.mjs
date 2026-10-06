const json = (body, status = 200, headers = {}) => Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
const dayInShanghai = (date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const validDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const idValid = (id) => Number.isSafeInteger(Number(id)) && Number(id) > 0;
const hash = async (value) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2, "0")).join("");
const cleanPath = (p) => typeof p === "string" && p.startsWith("/") ? p.slice(0, 180).replace(/[?#].*$/, "") : "/";
async function requireToken(request, expected) { return Boolean(expected && request.headers.get("authorization") === `Bearer ${expected}`); }
async function syncPosts(db, posts) {
  if (!Array.isArray(posts) || posts.length > 10000) throw new Error("Invalid posts");
  const stmts = [];
  for (const p of posts) {
    if (!idValid(p?.id) || typeof p.slug !== "string" || typeof p.title !== "string") throw new Error("Invalid post entry");
    // Insert once; later syncs refresh metadata while preserving live counts.
    stmts.push(db.prepare(`INSERT INTO posts(id,slug,title,views,likes,synced_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,synced_at=excluded.synced_at`)
      .bind(Number(p.id), p.slug.slice(0, 300), p.title.slice(0, 500), Math.max(0, Number(p.views) || 0), Math.max(0, Number(p.likes) || 0), new Date().toISOString()));
  }
  for (let i = 0; i < stmts.length; i += 80) await db.batch(stmts.slice(i, i + 80));
}
async function currentPost(db, id) { return db.prepare("SELECT id,views,likes FROM posts WHERE id=?").bind(Number(id)).first(); }
async function stats(db, id) { const p = await currentPost(db, id); return p ? { views: p.views, likes: p.likes } : null; }

export default {
  async fetch(request, env) {
    const u = new URL(request.url), path = u.pathname, method = request.method;
    try {
      if (path === "/health" && method === "GET") return json({ ok: true });
      if (path === "/admin/sync" && method === "POST") {
        if (!await requireToken(request, env.BLOG_ADMIN_TOKEN)) return json({ error: "unauthorized" }, 401);
        const body = await request.json();
        if (typeof body.revision !== "string" || !body.revision || body.revision.length > 200) return json({ error: "invalid revision" }, 400);
        await syncPosts(env.DB, body.posts);
        return json({ ok: true, revision: body.revision, synced: body.posts.length });
      }
      if (path === "/admin/summary" && method === "GET") {
        if (!await requireToken(request, env.BLOG_ADMIN_TOKEN)) return json({ error: "unauthorized" }, 401);
        const start = u.searchParams.get("start"), end = u.searchParams.get("end");
        if (!validDay(start) || !validDay(end) || start > end) return json({ error: "start/end must be YYYY-MM-DD with start <= end" }, 400);
        const [totals, daily, ranking] = await Promise.all([
          env.DB.prepare(`SELECT COUNT(*) AS pv, COUNT(DISTINCT session_id) AS sessions, COUNT(DISTINCT browser_id) AS uv FROM visitor_events WHERE day BETWEEN ? AND ?`).bind(start, end).first(),
          env.DB.prepare(`SELECT day,COUNT(*) AS pv,COUNT(DISTINCT session_id) AS sessions,COUNT(DISTINCT browser_id) AS uv FROM visitor_events WHERE day BETWEEN ? AND ? GROUP BY day ORDER BY day`).bind(start, end).all(),
          env.DB.prepare(`SELECT p.id,p.slug,p.title,COUNT(v.post_id) AS views,p.likes FROM posts p LEFT JOIN post_views v ON v.post_id=p.id AND v.day BETWEEN ? AND ? GROUP BY p.id ORDER BY views DESC,p.id LIMIT 20`).bind(start, end).all(),
        ]);
        return json({ timezone: "Asia/Shanghai", dateBoundary: "event date in Asia/Shanghai, inclusive start and end", source: "D1 visitor_events and posts", queriedAt: new Date().toISOString(), range: { start, end }, totals, daily: daily.results, ranking: ranking.results });
      }
      if (path === "/posts/stats" && method === "GET") {
        if (!await requireToken(request, env.BLOG_SERVICE_TOKEN)) return json({ error: "unauthorized" }, 401);
        const raw = u.searchParams.get("ids") || "";
        const ids = [...new Set(raw.split(",").filter(Boolean).map(Number))];
        if (!ids.length || ids.length > 100 || ids.some(id => !idValid(id))) return json({ error: "ids must contain 1-100 positive integers" }, 400);
        const stmts = ids.map(id => env.DB.prepare("SELECT id,views,likes FROM posts WHERE id=?").bind(id));
        const rows = await Promise.all(stmts.map(stmt => stmt.first()));
        const posts = Object.fromEntries(rows.filter(Boolean).map(row => [row.id, { views: row.views, likes: row.likes }]));
        return json({ posts }, 200, { "Cache-Control": "public, max-age=15, s-maxage=30" });
      }
      if (path === "/visitors/record" && method === "POST") {
        if (!await requireToken(request, env.BLOG_SERVICE_TOKEN)) return json({ error: "unauthorized" }, 401);
        const body = await request.json();
        if (![body.browserId, body.sessionId, body.eventId].every(x => typeof x === "string" && /^[\w-]{16,100}$/.test(x))) return json({ error: "invalid identity" }, 400);
        const now = new Date(), day = dayInShanghai(now);
        await env.DB.prepare("INSERT OR IGNORE INTO visitor_events(event_id,browser_id,session_id,path,day,created_at) VALUES(?,?,?,?,?,?)").bind(body.eventId, await hash(body.browserId), body.sessionId, cleanPath(body.path), day, now.toISOString()).run();
        return json({ ok: true, day });
      }
      if (path === "/visitors/location" && method === "GET") {
        if (!await requireToken(request, env.BLOG_SERVICE_TOKEN)) return json({ error: "unauthorized" }, 401);
        const ip = request.headers.get("X-Stats-Visitor-IP");
        if (!ip) return json({ code: 1, data: null }, 503);
        const geo = new URL("https://ipwho.is/"); geo.searchParams.set("ip", ip);
        const response = await fetch(geo, { signal: AbortSignal.timeout(2500), redirect: "error" });
        if (!response.ok) return json({ code: 1, data: null }, 502);
        const data = await response.json(); if (data.success === false) return json({ code: 1, data: null }, 502);
        return json({ code: 0, data: { city: data.city || "", region: data.region || "", country: data.country || "" } }, 200, { "Cache-Control": "private, max-age=3600" });
      }
      const m = path.match(/^\/posts\/(\d+)\/(stats|view|like|unlike)$/);
      if (!m) return json({ error: "not found" }, 404);
      const [, id, action] = m;
      if (!idValid(id)) return json({ error: "invalid id" }, 400);
      if (action === "stats" && method === "GET") {
        if (!await requireToken(request, env.BLOG_SERVICE_TOKEN)) return json({ error: "unauthorized" }, 401);
        const result = await stats(env.DB, id); return result ? json(result, 200, { "Cache-Control": "public, max-age=15, s-maxage=30" }) : json({ error: "not found" }, 404);
      }
      if (action === "view" && method === "POST") {
        if (!await requireToken(request, env.BLOG_SERVICE_TOKEN)) return json({ error: "unauthorized" }, 401);
        const body = await request.json();
        if (![body.browserId, body.sessionId].every(x => typeof x === "string" && /^[\w-]{16,100}$/.test(x))) return json({ error: "invalid identity" }, 400);
        await env.DB.prepare("INSERT OR IGNORE INTO post_views(post_id,session_id,day) SELECT id,?,? FROM posts WHERE id=?").bind(body.sessionId, dayInShanghai(), Number(id)).run();
        const result = await stats(env.DB, id); return result ? json(result) : json({ error: "not found" }, 404);
      }
      if ((action === "like" || action === "unlike") && method === "POST") {
        if (!await requireToken(request, env.BLOG_SERVICE_TOKEN)) return json({ error: "unauthorized" }, 401);
        const body = await request.json();
        if (typeof body.browserId !== "string" || !/^[\w-]{16,100}$/.test(body.browserId) || typeof body.liked !== "boolean" || body.liked !== (action === "like")) return json({ error: "invalid request" }, 400);
        const key = await hash(body.browserId);
        const post = await currentPost(env.DB, id); if (!post) return json({ error: "not found" }, 404);
        if (body.liked) await env.DB.prepare("INSERT OR IGNORE INTO post_likes(post_id,browser_hash) SELECT id,? FROM posts WHERE id=?").bind(key, Number(id)).run();
        else await env.DB.prepare("DELETE FROM post_likes WHERE post_id=? AND browser_hash=?").bind(Number(id), key).run();
        return json({ likes: (await currentPost(env.DB, id)).likes });
      }
      return json({ error: "method not allowed" }, 405);
    } catch (error) { return json({ error: error?.message === "Invalid posts" || error?.message === "Invalid post entry" ? error.message : "request failed" }, 500); }
  }
};

export { dayInShanghai, syncPosts };
