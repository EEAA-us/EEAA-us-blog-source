import { cloudStatsRequest, localBackend, publishedMode, isSameOriginWrite } from "@/lib/cloud-stats";
export async function POST(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  if (!/^\d+$/.test(postId)) return Response.json({ error: "invalid id" }, { status: 400 });
  if (!isSameOriginWrite(request)) return Response.json({ error: "same-origin request required" }, { status: 403 });
  if (!publishedMode()) {
    const response = await localBackend(`api/posts/detail/${postId}`);
    if (!response.ok) return response; const post = await response.json(); return Response.json({ views: post.views, likes: post.likes });
  }
  try {
    const body = await request.json();
    const response = await cloudStatsRequest(`posts/${postId}/view`, { method: "POST", body: JSON.stringify({ browserId: body.browserId, sessionId: body.sessionId }) });
    return Response.json(await response.json());
  }
  catch { return Response.json({ error: "view unavailable" }, { status: 502 }); }
}
