import { cloudStatsRequest, localBackend, publishedMode } from "@/lib/cloud-stats";
export async function GET(_request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  if (!/^\d+$/.test(postId)) return Response.json({ error: "invalid id" }, { status: 400 });
  if (!publishedMode()) {
    const response = await localBackend(`api/posts/detail/${postId}`);
    if (!response.ok) return response;
    const post = await response.json(); return Response.json({ views: post.views, likes: post.likes }, { headers: { "Cache-Control": "no-store" } });
  }
  try { const response = await cloudStatsRequest(`posts/${postId}/stats`); return Response.json(await response.json(), { headers: { "Cache-Control": "private, max-age=15" } }); }
  catch { return Response.json({ error: "stats unavailable" }, { status: 502 }); }
}
