import { NextRequest, NextResponse } from "next/server";
import { readTiboFeed } from "@/lib/tibo-feed";

export async function GET(request: NextRequest) {
  try { return NextResponse.json(await readTiboFeed(request.signal)); }
  catch { return NextResponse.json({ message: "Tibo动态暂时无法加载，请稍后重试。" }, { status: 502 }); }
}
