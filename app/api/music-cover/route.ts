import { NextRequest, NextResponse } from "next/server";

const MAX_BYTES = 2 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const value = request.nextUrl.searchParams.get("url") ?? "";
  let path: string;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !/^p[1-4]\.music\.126\.net$/.test(url.hostname) || url.port || url.username || url.password
      || !/^\/[A-Za-z0-9_-]+={0,2}\/\d+\.(jpg|png)$/.test(url.pathname)) throw new Error("Invalid cover");
    path = url.pathname;
  } catch {
    return NextResponse.json({ message: "无效的音乐封面" }, { status: 400 });
  }
  try {
    const response = await fetch(`https://p3.music.126.net${path}?param=300y300`, {
      signal: AbortSignal.timeout(10000), redirect: "error", next: { revalidate: 86400 },
    });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !/^image\/(jpeg|jpg|png)(;|$)/i.test(type)
      || Number(response.headers.get("content-length")) > MAX_BYTES) {
      await response.body?.cancel();
      throw new Error("Cover unavailable");
    }
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) throw new Error("Invalid cover size");
    return new NextResponse(bytes, { headers: {
      "Content-Type": type, "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return NextResponse.json({ message: "封面暂时无法加载" }, { status: 502 });
  }
}
