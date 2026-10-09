import { NextRequest, NextResponse } from "next/server";
import { withRequestDeadline } from "@/lib/bounded-request";

const BASE = "https://uapis.cn/api/v1";

function getTargetUrl(req: NextRequest) {
  const subPath = req.nextUrl.searchParams.get("path");
  if (!subPath) return null;
  const params = new URLSearchParams(req.nextUrl.searchParams);
  params.delete("path");
  const qs = params.toString();
  return `${BASE}/${subPath}${qs ? `?${qs}` : ""}`;
}

export async function GET(req: NextRequest) {
  const url = getTargetUrl(req);
  if (!url) return NextResponse.json({ message: "Missing 'path' parameter." }, { status: 400 });
  try {
    const result = await withRequestDeadline(req.signal, 10_000, async signal => {
      const res = await fetch(url, { signal });
      return { data: await res.json(), status: res.status };
    });
    return NextResponse.json(result.data, { status: result.status });
  } catch {
    return NextResponse.json({ message: "请求外部API失败" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const url = getTargetUrl(req);
  if (!url) return NextResponse.json({ message: "Missing 'path' parameter." }, { status: 400 });
  try {
    const result = await withRequestDeadline(req.signal, 10_000, async signal => {
      const body = await req.json();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
      return { data: await res.json(), status: res.status };
    });
    return NextResponse.json(result.data, { status: result.status });
  } catch {
    return NextResponse.json({ message: "请求外部API失败" }, { status: 502 });
  }
}
