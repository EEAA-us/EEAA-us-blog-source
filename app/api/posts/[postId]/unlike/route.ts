import { cloudStatsRequest, localBackend, publishedMode, isSameOriginWrite } from "@/lib/cloud-stats";
export async function POST(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  if (!/^\d+$/.test(postId)) return Response.json({ error: "invalid id" }, { status: 400 });
  if (!isSameOriginWrite(request)) return Response.json({ error: "same-origin request required" }, { status: 403 });
  if (!publishedMode()) {
    return localBackend(`api/posts/${postId}/unlike`, request);
  }
  try { const body = await request.json(); const response = await cloudStatsRequest(`posts/${postId}/unlike`, { method: "POST", body: JSON.stringify({ browserId: body.browserId, liked: false }) }); return Response.json(await response.json()); }
  catch { return Response.json({ error: "unlike unavailable" }, { status: 502 }); }
}
