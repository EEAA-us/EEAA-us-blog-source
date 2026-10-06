import { NextRequest, NextResponse } from "next/server";
import { ProxyAgent, fetch } from "undici";

const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
const proxy = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
const MAX_BYTES = 8 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const ext = request.nextUrl.searchParams.get("ext");
  if (!/^[a-z0-9]{6}$/.test(id) || !["jpg", "png"].includes(ext ?? "")) {
    return NextResponse.json({ message: "无效的图片地址" }, { status: 400 });
  }
  try {
    // A fixed CDN URL avoids browser connectivity issues and random redirects.
    const url = `https://w.wallhaven.cc/full/${id.slice(0, 2)}/wallhaven-${id}.${ext}`;
    const response = await fetch(url, { dispatcher: proxy, signal: AbortSignal.timeout(20000) });
    if (!response.ok || Number(response.headers.get("content-length")) > MAX_BYTES) {
      await response.body?.cancel();
      throw new Error("Wallpaper unavailable");
    }
    if (!response.body) throw new Error("Wallpaper body missing");
    let size = 0;
    const reader = response.body.getReader();
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) { controller.close(); return; }
          size += value.byteLength;
          if (size > MAX_BYTES) { await reader.cancel(); throw new Error("Wallpaper too large"); }
          controller.enqueue(value);
        } catch (error) { controller.error(error); }
      },
      cancel(reason) { return reader.cancel(reason); },
    });
    return new NextResponse(body, { headers: {
      "Content-Type": ext === "png" ? "image/png" : "image/jpeg",
      "Cache-Control": "public, max-age=86400, immutable",
    } });
  } catch {
    return NextResponse.json({ message: "图片暂时无法加载，请换一张" }, { status: 502 });
  }
}
