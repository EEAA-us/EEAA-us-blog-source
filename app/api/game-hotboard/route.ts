import { NextRequest, NextResponse } from "next/server";
import { withRequestDeadline } from "@/lib/bounded-request";

const TOPICS = {
  overwatch: { keyword: "守望先锋", matches: /守望先锋|overwatch/i },
  "wuthering-waves": { keyword: "鸣潮", matches: /鸣潮|wuthering\s*waves/i },
};
const SOURCES = [{ type: "bilibili", name: "B站" }, { type: "tieba", name: "贴吧" }];

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  if (!type || !Object.hasOwn(TOPICS, type)) return NextResponse.json({ message: "不支持的话题" }, { status: 400 });
  const topic = TOPICS[type as keyof typeof TOPICS];
  const results = await Promise.allSettled(SOURCES.map(source =>
    withRequestDeadline(req.signal, 10_000, async signal => {
      const response = await fetch(`https://uapis.cn/api/v1/misc/hotboard?type=${source.type}`, { signal, next: { revalidate: 60 } });
      if (!response.ok) throw new Error("热榜来源暂不可用");
      const data = await response.json();
      if (!Array.isArray(data?.list)) throw new Error("无效热榜数据");
      return data.list.flatMap((item: { title?: unknown; url?: unknown; hot_value?: unknown }) => {
        if (typeof item.title !== "string" || !topic.matches.test(item.title) || typeof item.url !== "string" || !/^https?:\/\//i.test(item.url)) return [];
        return [{ title: item.title, url: item.url, hot_value: String(item.hot_value ?? ""), source: source.name }];
      });
    })
  ));
  const available = results.filter(result => result.status === "fulfilled");
  if (!available.length) return NextResponse.json({ message: "相关热榜暂时无法加载，请重试" }, { status: 502 });
  const seen = new Set<string>();
  const list = available.flatMap(result => result.value).filter(item => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  }).map((item, index) => ({ ...item, index: index + 1 }));
  return NextResponse.json({ type, list, update_time: "",
    notice: `从B站、贴吧热榜筛选相关话题，按来源排列，并非游戏独立排行榜。${available.length < SOURCES.length ? "部分来源暂不可用。" : ""}`,
    more_url: `https://search.bilibili.com/all?keyword=${encodeURIComponent(topic.keyword)}`,
  });
}
