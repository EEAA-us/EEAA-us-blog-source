import "server-only";

const workerUrl = () => process.env.BLOG_STATS_URL?.replace(/\/+$/, "");

export async function cloudStatsRequest(path: string, init: RequestInit = {}, admin = false) {
  const base = workerUrl();
  const token = admin ? process.env.BLOG_STATS_ADMIN_TOKEN : process.env.BLOG_STATS_SERVICE_TOKEN;
  if (!base || !token) throw new Error("Cloud stats is not configured");
  const url = new URL(path.replace(/^\/+/, ""), `${base}/`);
  if (url.origin !== new URL(base).origin) throw new Error("Invalid stats path");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(url, {
      ...init,
      headers: { ...Object.fromEntries(new Headers(init.headers)), Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Cloud stats returned ${response.status}`);
    return response;
  } finally { clearTimeout(timeout); }
}

export async function localBackend(path: string, request?: Request) {
  const target = new URL(path.replace(/^\/+/, ""), "http://127.0.0.1:8000/");
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const method = request?.method || "GET";
    const headers = new Headers();
    if (request?.headers.get("content-type")) headers.set("Content-Type", request.headers.get("content-type")!);
    if (request?.headers.get("x-path")) headers.set("x-path", request.headers.get("x-path")!);
    const response = await fetch(target, { method, ...(method !== "GET" && request ? { body: await request.text() } : {}), headers, cache: "no-store", signal: controller.signal });
    return new Response(response.body, { status: response.status, headers: { "Content-Type": response.headers.get("content-type") || "application/json", "Cache-Control": "no-store" } });
  } finally { clearTimeout(timer); }
}

export function publishedMode() { return process.env.NEXT_PUBLIC_CONTENT_MODE === "published"; }

export function isSameOriginWrite(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") === "same-origin";
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
