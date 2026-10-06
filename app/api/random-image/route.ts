import { NextRequest, NextResponse } from "next/server";
import { chooseWallpaper, parseSeenIds, type WallpaperRecord } from "@/lib/server/wallpaper-pool";

const filters = {
  featured: { categories: "100", sorting: "toplist", topRange: "1M" },
  anime: { categories: "010", sorting: "toplist", topRange: "1M" },
  landscape: { categories: "100", q: "landscape", sorting: "toplist", topRange: "1M" },
  desktop: { categories: "110", ratios: "16x9", sorting: "toplist", topRange: "1M" },
  portrait: { categories: "100", ratios: "9x16", sorting: "toplist", topRange: "1y" },
} as const;

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category") ?? "featured";
  const kind = request.nextUrl.searchParams.get("kind") ?? "random";
  if (!Object.hasOwn(filters, category) || !["random", "4k"].includes(kind) ||
      (kind === "4k" && !["anime", "landscape"].includes(category))) {
    return NextResponse.json({ message: "不支持的图片分类" }, { status: 400 });
  }
  try {
    const is4k = kind === "4k";
    const portrait = category === "portrait";
    const query = new URL("https://wallhaven.cc/api/v1/search");
    query.search = new URLSearchParams({
      purity: "100", ...filters[category as keyof typeof filters],
      ...(is4k ? { resolutions: "3840x2160" } : { atleast: portrait ? "1080x1920" : "1920x1080" }),
    }).toString();
    const accepts = (image: WallpaperRecord) => is4k
      ? image.dimension_x === 3840 && image.dimension_y === 2160
      : image.dimension_x >= (portrait ? 1080 : 1920) && image.dimension_y >= (portrait ? 1920 : 1080);
    const image = await chooseWallpaper(`${kind}:${category}`, query, accepts, parseSeenIds(request.nextUrl));
    const ext = image.path.endsWith(".png") ? "png" : "jpg";
    const imageUrl = `/api/wallpaper?id=${image.id}&ext=${ext}`;
    return NextResponse.json({ id: image.id, imageUrl, previewUrl: imageUrl, sourceUrl: image.url, width: image.dimension_x, height: image.dimension_y }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ message: "图片来源暂时无法访问，请稍后重试" }, { status: 502 });
  }
}
