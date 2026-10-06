import { NextRequest, NextResponse } from "next/server";
import { chooseWallpaper, parseSeenIds } from "@/lib/server/wallpaper-pool";

const gameQueries = {
  genshin: "Genshin Impact",
  starrail: "Honkai Star Rail",
  zzz: "Zenless Zone Zero",
  wuthering: "Wuthering Waves",
} as const;

export async function GET(request: NextRequest) {
  const game = request.nextUrl.searchParams.get("game");
  if (!game || !Object.hasOwn(gameQueries, game)) {
    return NextResponse.json({ message: "不支持的游戏" }, { status: 400 });
  }
  try {
    const query = new URL("https://wallhaven.cc/api/v1/search");
    query.search = new URLSearchParams({
      q: gameQueries[game as keyof typeof gameQueries], categories: "110", purity: "100",
      sorting: "favorites", atleast: "1920x1080",
    }).toString();
    const image = await chooseWallpaper(`game:${game}`, query,
      (item) => item.dimension_x >= 1920 && item.dimension_y >= 1080,
      parseSeenIds(request.nextUrl));
    const ext = image.path.endsWith(".png") ? "png" : "jpg";
    const imageUrl = `/api/wallpaper?id=${image.id}&ext=${ext}`;
    return NextResponse.json({ id: image.id, imageUrl, previewUrl: imageUrl, sourceUrl: image.url }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ message: "图片来源暂时无法访问，请稍后重试" }, { status: 502 });
  }
}
