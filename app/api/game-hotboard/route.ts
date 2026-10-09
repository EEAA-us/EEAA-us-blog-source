import { NextRequest, NextResponse } from "next/server";
import { withRequestDeadline } from "@/lib/bounded-request";

const UAPI = "https://uapis.cn/api/v1";
const DEADLINE_MS = 10_000;
const TOPICS = {
  overwatch: { keyword: "守望先锋", matches: /守望先锋|overwatch/i },
  "wuthering-waves": { keyword: "鸣潮", matches: /鸣潮|wuthering\s*waves/i },
};

type BoardItem = {
  index?: number;
  title: string;
  url: string;
  hot_value: string;
  source: string;
  publish_time?: string;
};

function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function getJson(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal, next: { revalidate: 60 } });
  if (!response.ok) throw new Error("来源暂不可用");
  return response.json();
}

async function getOverwatch(signal: AbortSignal): Promise<BoardItem[]> {
  const data = await getJson("https://us.forums.blizzard.com/en/overwatch/top.json?period=weekly", signal);
  const topics = data?.topic_list?.topics;
  if (!Array.isArray(topics)) throw new Error("论坛榜单数据无效");

  return topics.flatMap((topic: Record<string, unknown>, position: number) => {
    if (typeof topic.title !== "string" || !topic.title.trim() || typeof topic.slug !== "string" ||
      !/^[a-z0-9-]+$/i.test(topic.slug) || !Number.isSafeInteger(topic.id) || Number(topic.id) <= 0) return [];
    const url = safeHttpUrl(`https://us.forums.blizzard.com/en/overwatch/t/${encodeURIComponent(topic.slug)}/${topic.id}`);
    if (!url) return [];
    const views = Number.isFinite(topic.views) ? `${topic.views} 浏览` : "";
    const replies = Number.isFinite(topic.posts_count) ? `${Math.max(0, Number(topic.posts_count) - 1)} 回复` : "";
    const likes = Number.isFinite(topic.like_count) ? `${topic.like_count} 赞` : "";
    return [{ index: position + 1, title: topic.title.trim(), url, hot_value: [views, replies, likes].filter(Boolean).join(" · "), source: "暴雪论坛周榜" }];
  });
}

async function getWutheringHotboard(signal: AbortSignal, matches: RegExp): Promise<BoardItem[]> {
  const data = await getJson(`${UAPI}/misc/hotboard?type=bilibili`, signal);
  if (!Array.isArray(data?.list)) throw new Error("B站热榜数据无效");
  return data.list.flatMap((item: { title?: unknown; url?: unknown; hot_value?: unknown }, position: number) => {
    if (typeof item.title !== "string" || !matches.test(item.title)) return [];
    const url = safeHttpUrl(item.url);
    if (!url) return [];
    return [{ index: position + 1, title: item.title.trim(), url, hot_value: typeof item.hot_value === "string" ? item.hot_value : "", source: "B站全站热榜" }];
  });
}

async function getWutheringSearch(signal: AbortSignal, matches: RegExp): Promise<BoardItem[]> {
  const response = await fetch(`${UAPI}/search/aggregate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "鸣潮 游戏", sort: "date" }),
    signal,
  });
  if (!response.ok) throw new Error("聚合搜索暂不可用");
  const data = await response.json();
  if (!Array.isArray(data?.results)) throw new Error("聚合搜索数据无效");

  return data.results.flatMap((item: { title?: unknown; url?: unknown; publish_time?: unknown }) => {
    if (typeof item.title !== "string" || !item.title.trim() || !matches.test(item.title)) return [];
    const url = safeHttpUrl(item.url);
    if (!url) return [];
    return [{
      title: item.title.trim(), url, hot_value: "", source: "UAPI 聚合搜索",
      ...(typeof item.publish_time === "string" && Number.isFinite(Date.parse(item.publish_time)) ? { publish_time: item.publish_time } : {}),
    }];
  });
}

function uniqueByUrl(items: BoardItem[]): BoardItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  if (!type || !Object.hasOwn(TOPICS, type)) return NextResponse.json({ message: "不支持的话题" }, { status: 400 });
  const topic = TOPICS[type as keyof typeof TOPICS];
  const signal = req.signal;

  if (type === "overwatch") {
    try {
      const list = await withRequestDeadline(signal, DEADLINE_MS, getOverwatch);
      return NextResponse.json({ type, list, update_time: "", notice: "暴雪官方论坛周榜，保留论坛原榜次及互动数据；不是全网热搜。", more_url: "https://us.forums.blizzard.com/en/overwatch/top?period=weekly" });
    } catch {
      return NextResponse.json({ message: "守望先锋论坛周榜暂时无法加载，请重试" }, { status: 502 });
    }
  }

  const sources = await Promise.allSettled([
    withRequestDeadline(signal, DEADLINE_MS, childSignal => getWutheringHotboard(childSignal, topic.matches)),
    withRequestDeadline(signal, DEADLINE_MS, childSignal => getWutheringSearch(childSignal, topic.matches)),
  ]);
  const available = sources.filter((source): source is PromiseFulfilledResult<BoardItem[]> => source.status === "fulfilled");
  if (available.length === 0) return NextResponse.json({ message: "鸣潮相关内容暂时无法加载，请重试" }, { status: 502 });

  const hotboard = sources[0].status === "fulfilled" ? sources[0].value : [];
  const search = sources[1].status === "fulfilled" ? sources[1].value : [];
  const list = uniqueByUrl([...hotboard, ...search]);
  const partialFailure = available.length < sources.length;
  return NextResponse.json({
    type,
    list,
    update_time: "",
    notice: `B站全站热榜命中保留原榜次；其余为UAPI聚合搜索结果（固定关键词“鸣潮 游戏”，按服务端日期顺序）。搜索结果不是热度排名。${partialFailure ? "部分来源暂不可用。" : ""}`,
    more_url: `https://search.bilibili.com/all?keyword=${encodeURIComponent(topic.keyword)}`,
  });
}
