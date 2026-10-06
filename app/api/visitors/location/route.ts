import { isIP } from "node:net";
import { cloudStatsRequest, localBackend, publishedMode } from "@/lib/cloud-stats";
export const runtime = "nodejs";

function trustedVisitorIp(request: Request) {
  // Vercel supplies the client IP, overwriting untrusted forwarded values.
  // Prefer its dedicated header; never accept an IP from body or query.
  const chain = (request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for"))?.split(",") || [];
  for (const entry of chain.reverse()) {
    const candidate = entry.trim();
    if (isIP(candidate)) return candidate;
  }
  return null;
}

export async function GET(request: Request) {
  if (!publishedMode()) return localBackend("api/visitors/location", request);
  const visitorIp = trustedVisitorIp(request);
  if (!visitorIp) return Response.json({ code: 1, data: null }, { status: 503, headers: { "Cache-Control": "no-store" } });
  try { const response = await cloudStatsRequest("visitors/location", { headers: { "X-Stats-Visitor-IP": visitorIp } }); return Response.json(await response.json(), { headers: { "Cache-Control": "private, max-age=3600" } }); }
  catch { return Response.json({ code: 1, data: null }, { status: 502 }); }
}
