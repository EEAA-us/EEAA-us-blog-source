import { NextRequest, NextResponse } from "next/server";
import Meting from "@meting/core";

// Resolve signed URLs on demand: playlist metadata must not retain expired CDN links.
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const range = request.headers.get("range");
  if (!/^\d{1,20}$/.test(id) || (range && !/^bytes=\d*-\d*$/.test(range))) {
    return NextResponse.json({ message: "无效的音频请求" }, { status: 400 });
  }
  try {
    const meting = new Meting("netease");
    meting.format(true);
    let response: Response | undefined;
    let upstreamFailed = false;
    // Retry with a standard lower bitrate when the highest quality is unavailable.
    // Both URLs come from Meting's official NetEase resolver; no access controls are bypassed.
    for (const bitrate of [320, 128]) {
      try {
        const data = JSON.parse(await meting.url(id, bitrate) as string);
        if (!data.url) continue;
        const url = new URL(data.url);
        url.protocol = "https:";
        if (!/^m\d+\.music\.126\.net$/.test(url.hostname) || url.port || url.username || url.password) continue;
        const candidate = await fetch(url, {
          headers: range ? { Range: range } : {}, redirect: "error", cache: "no-store",
          signal: AbortSignal.any([request.signal, AbortSignal.timeout(30000)]),
        });
        if (candidate.status === 416) {
          const headers = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
          const contentRange = candidate.headers.get("content-range");
          if (contentRange) headers.set("Content-Range", contentRange);
          await candidate.body?.cancel();
          return new NextResponse(null, { status: 416, headers });
        }
        const type = candidate.headers.get("content-type") ?? "";
        if (candidate.ok && /^(audio\/|application\/octet-stream)/i.test(type)) { response = candidate; break; }
        upstreamFailed = true;
        await candidate.body?.cancel();
      } catch (error) {
        if (request.signal.aborted) throw error;
        upstreamFailed = true;
        // Try the lower standard bitrate when resolving or fetching the first one fails.
      }
    }
    if (!response) return NextResponse.json({ message: upstreamFailed ? "音频来源暂时无法连接，请稍后重试" : "这首歌在当前来源下不可播放" }, { status: upstreamFailed ? 502 : 404 });
    const headers = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    for (const key of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const value = response.headers.get(key);
      if (value) headers.set(key, value);
    }
    return new NextResponse(response.body, { status: response.status, headers });
  } catch {
    return NextResponse.json({ message: "音频暂时无法加载，请稍后重试" }, { status: 502 });
  }
}
