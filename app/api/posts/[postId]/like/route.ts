import { cloudStatsRequest, localBackend, publishedMode, isSameOriginWrite } from "@/lib/cloud-stats";
export async function POST(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  if (!/^\d+$/.test(postId)) return Response.json({ error: "invalid id" }, { status: 400 });
  if (!isSameOriginWrite(request)) return Response.json({ error: "same-origin request required" }, { status: 403 });
  if (!publishedMode()) {
    const response = await localBackend(`api/posts/${postId}/like`, request);
    return new Response(response.body, { status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  }
  try { const body = await request.json(); const response = await cloudStatsRequest(`posts/${postId}/like`, { method: "POST", body: JSON.stringify({ browserId: body.browserId, liked: true }) }); return Response.json(await response.json()); }
  catch { return Response.json({ error: "like unavailable" }, { status: 502 }); }
}
