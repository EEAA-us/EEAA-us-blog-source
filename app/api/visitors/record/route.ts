import { cloudStatsRequest, localBackend, publishedMode, isSameOriginWrite } from "@/lib/cloud-stats";
export async function POST(request: Request) {
  if (!isSameOriginWrite(request)) return Response.json({ error: "same-origin request required" }, { status: 403 });
  if (!publishedMode()) {
    const body = await request.clone().json().catch(() => ({}));
    const localRequest = new Request(request.url, { method: "POST", headers: { "content-type": "application/json", "x-path": typeof body.path === "string" ? body.path : "/" } });
    return localBackend("api/visitors/record", localRequest);
  }
  try { const body = await request.json(); const response = await cloudStatsRequest("visitors/record", { method: "POST", body: JSON.stringify({ eventId: body.eventId, path: body.path, browserId: body.browserId, sessionId: body.sessionId }) }); return Response.json(await response.json()); }
  catch { return Response.json({ error: "visitor record unavailable" }, { status: 502 }); }
}
