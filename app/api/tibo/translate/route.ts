import { NextRequest, NextResponse } from "next/server";
import { readTiboFeed } from "@/lib/tibo-feed";
import { withRequestDeadline } from "@/lib/bounded-request";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const language = request.nextUrl.searchParams.get("lang") === "en" ? "en" : "zh";
  if (!id || !/^\d{10,25}$/.test(id)) return NextResponse.json({ message: "无效动态编号" }, { status: 400 });
  try {
    return await withRequestDeadline(request.signal, 20_000, async signal => {
      const feed = await readTiboFeed(signal);
      const post = feed.posts.find(item => item.id === id);
      if (!post) return NextResponse.json({ message: "这条动态已不在当前列表，请刷新动态。" }, { status: 404 });
      if (post.text.length > 3000) return NextResponse.json({ message: "这条原文较长，暂不自动翻译。" }, { status: 422 });
      const response = await fetch("https://uapis.cn/api/v1/translate/text", {
        method: "POST", signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: post.text, to_lang: language }), next: { revalidate: 86400 },
      });
      if (!response.ok) throw new Error("翻译服务暂不可用");
      const data = await response.json();
      if (typeof data.translate !== "string" || !data.translate.trim()) throw new Error("翻译结果为空");
      return NextResponse.json({ id, language, text: data.translate, machineTranslated: true });
    });
  } catch { return NextResponse.json({ message: "翻译暂时无法完成，原文仍可阅读。" }, { status: 502 }); }
}
