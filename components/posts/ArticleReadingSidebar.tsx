"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Camera, FolderGit2 } from "lucide-react";
import ProfileCard from "@/components/ui/ProfileCard";
import { useTranslation } from "@/lib/i18n";
import { useMusic } from "@/components/providers/MusicProvider";

const CloudPlayer = dynamic(() => import("@/components/music/CloudPlayer"), {
  ssr: false,
  loading: () => <div className="editorial-panel min-h-[240px]" aria-hidden="true" />,
});
const LyricBar = dynamic(() => import("@/components/music/LyricBar"), { ssr: false });

export default function ArticleReadingSidebar() {
  const { tx } = useTranslation();
  const { isLoading, currentSong } = useMusic();
  return (
    <aside aria-label={tx("文章阅读辅助功能")} className="space-y-4">
      <ProfileCard />
      <CloudPlayer />
      {(isLoading || currentSong) && <div className="min-h-24"><LyricBar /></div>}
      <nav aria-label={tx("继续浏览")} className="editorial-panel p-4">
        <h2 className="mb-2 px-2 text-sm font-bold">{tx("继续浏览")}</h2>
        {[
          { href: "/posts#page-content", label: "全部文章", icon: BookOpen },
          { href: "/projects", label: "项目记录", icon: FolderGit2 },
          { href: "/photowall", label: "照片日常", icon: Camera },
        ].map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-xs text-slate-500 transition-colors hover:bg-sky-500/10 hover:text-sky-500 dark:text-slate-400">
          <Icon className="h-4 w-4" />{tx(label)}<ArrowUpRight className="ml-auto h-3 w-3" />
        </Link>)}
      </nav>
    </aside>
  );
}
