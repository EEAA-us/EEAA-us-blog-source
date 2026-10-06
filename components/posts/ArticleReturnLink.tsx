"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function ArticleReturnLink({ footer = false }: { footer?: boolean }) {
  const [archiveHref, setArchiveHref] = useState<string | null>(null);
  const { tx } = useTranslation();
  const pathname = usePathname();
  useEffect(() => {
    const source = new URLSearchParams(window.location.search);
    if (source.get("from") !== "archive") { queueMicrotask(() => setArchiveHref(null)); return; }
    const target = new URLSearchParams({ view: source.get("archiveView") === "vertical" ? "vertical" : "horizontal" });
    const year = source.get("archiveYear");
    const post = source.get("archivePost");
    if (year && /^\d{4}$/.test(year)) target.set("year", year);
    if (post && /^\d+$/.test(post)) target.set("post", post);
    target.set("restore", "1");
    queueMicrotask(() => setArchiveHref(`/timeline?${target}#page-content`));
  }, [pathname]);
  return <Link href={archiveHref ?? "/posts#page-content"} scroll={!archiveHref} className={`detail-breadcrumb-link font-medium ${footer ? "text-sky-500 hover:underline" : "hover:text-sky-500"}`}>
    <ArrowLeft aria-hidden="true" />{archiveHref ? tx("返回归档") : footer ? tx("继续发现文章") : tx("文章")}
  </Link>;
}
