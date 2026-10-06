import { cloudStatsRequest, localBackend, publishedMode } from "@/lib/cloud-stats";

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("ids") || "";
  const ids = [...new Set(raw.split(",").filter(Boolean))];
  if (!ids.length || ids.length > 100 || ids.some((id) => !/^\d+$/.test(id))) return Response.json({ error: "ids must contain 1-100 positive integers" }, { status: 400 });
  if (!publishedMode()) {
    const rows = await Promise.all(ids.map(async (id) => {
      const response = await localBackend(`api/posts/detail/${id}`);
      if (!response.ok) return null;
      const post = await response.json(); return [id, { views: post.views, likes: post.likes }] as const;
    }));
    return Response.json({ posts: Object.fromEntries(rows.filter((row): row is NonNullable<typeof row> => row !== null)) });
  }
  try {
    const response = await cloudStatsRequest(`posts/stats?ids=${ids.join(",")}`);
    return Response.json(await response.json(), { headers: { "Cache-Control": "private, max-age=15" } });
  } catch { return Response.json({ error: "stats unavailable" }, { status: 502 }); }
}
