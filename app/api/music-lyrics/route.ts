import { NextRequest, NextResponse } from "next/server";
import Meting from "@meting/core";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^\d{1,20}$/.test(id)) return NextResponse.json({ message: "无效的歌曲ID" }, { status: 400 });
  try {
    const meting = new Meting("netease");
    meting.format(true);
    const data = JSON.parse(await meting.lyric(id) as string);
    if (typeof data.lyric !== "string") throw new Error("Lyrics unavailable");
    return new NextResponse(data.lyric, { headers: {
      "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400",
    } });
  } catch {
    return NextResponse.json({ message: "歌词暂时无法加载" }, { status: 502 });
  }
}
