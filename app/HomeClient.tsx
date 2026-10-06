"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, BookOpen, Camera, FolderGit2, Wrench } from "lucide-react";
import SearchBar from "@/components/ui/SearchBar";
import PageCover, { CoverTransition } from "@/components/ui/PageCover";
import ArticleFeed from "@/components/home/ArticleFeed";
import { siteConfig } from "@/siteConfig";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { resolveHomeCardAppearance } from "@/lib/home-card-colors";
import HomeCalendar from "@/components/home/HomeCalendar";
import HomeStats from "@/components/home/HomeStats";
import ProfileCard from "@/components/ui/ProfileCard";
import { useTranslation } from "@/lib/i18n";

const CloudPlayer = dynamic(() => import("@/components/music/CloudPlayer"), { ssr: false });
const LyricBar = dynamic(() => import("@/components/music/LyricBar"), { ssr: false });
const PhotoWallPreview = dynamic(() => import("@/components/home/PhotoWallPreview"), { ssr: false });
const DogDiary = dynamic(() => import("@/components/home/DogDiary"), { ssr: false });
const SiteDashboard = dynamic(() => import("@/components/widgets/SiteDashboard"), { ssr: false });

export default function HomeClient({ postCount, photoCount }: { postCount: number | null; photoCount: number | null }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<number | null>(null);
  const [diaryOpen, setDiaryOpen] = useState(false);
  const { preferences, reducedMotion } = useAppearance();
  const { theme } = useTheme();
  const { tx } = useTranslation();
  const homeCardStyle = useMemo(() => {
    if (preferences.homeCardColor === "theme") return undefined;
    return { ...resolveHomeCardAppearance(preferences, theme === "dark").variables, color: "var(--ui-on-surface)" };
  }, [preferences, theme]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame = 0;
    const coverHeight = () => root.querySelector(".page-cover")?.clientHeight ?? window.innerHeight;
    const cover = root.querySelector<HTMLElement>(".page-cover");
    const copy = root.querySelector<HTMLElement>(".page-cover-copy");
    const waves = root.querySelector<HTMLElement>(".page-cover-transition");
    let pinDistance = 0;
    let distance = Math.max(1, coverHeight() * 0.5);
    let previousScroll = 0;
    const measure = () => {
      const height = coverHeight();
      const copyBottom = cover && copy ? copy.getBoundingClientRect().bottom - cover.getBoundingClientRect().top : height;
      const waveHeight = Math.max(0, Math.min(Math.min(112, Math.max(64, window.innerWidth * 0.08)) * preferences.waveAmplitude / 100, height - copyBottom - 24));
      root.style.setProperty("--home-wave-height", `${waveHeight}px`);
      pinDistance = Math.max(0, Math.min(120, height * 0.15, height - copyBottom - waveHeight - 24));
      root.style.setProperty("--home-pin-distance", `${pinDistance}px`);
      distance = Math.max(1, height * 0.5);
      previousScroll = Math.max(0, window.scrollY - pinDistance);
    };
    measure();
    if (revealRef.current === null) {
      revealRef.current = reducedMotion ? 1 : 0;
      root.style.setProperty("--home-reveal", String(revealRef.current));
    }
    const update = () => {
      frame = 0;
      if (reducedMotion) return;
      const scroll = Math.max(0, window.scrollY - pinDistance);
      revealRef.current = Math.min(1, Math.max(0, (revealRef.current ?? 1) + (scroll - previousScroll) / distance));
      previousScroll = scroll;
      root.style.setProperty("--home-reveal", String(revealRef.current));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = new ResizeObserver(measure);
    if (cover) observer.observe(cover);
    if (copy) observer.observe(copy);
    if (waves) observer.observe(waves);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
    };
  }, [reducedMotion, preferences.waveAmplitude]);

  return (
    <div ref={rootRef} className="home-editorial relative z-10">
      <div className="home-cover-stage">
        <PageCover title={siteConfig.title} description={siteConfig.bio} home />
      </div>
      <div id="page-content" className="home-content-stage relative">
        <CoverTransition />
        <div className="site-page-width relative mx-auto px-2 pb-12 pt-6 sm:px-4 sm:pt-8">
        <div className="home-layout grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_280px]" style={homeCardStyle}>
          <aside aria-label={tx("个人信息与音乐")} className="min-w-0 space-y-4 max-lg:order-2">
            <ProfileCard />
            <CloudPlayer />
            <LyricBar />
            <HomeStats postCount={postCount} photoCount={photoCount} />
          </aside>
          <ArticleFeed />
          <aside aria-label={tx("探索与照片")} className="min-w-0 space-y-4 max-lg:order-3 lg:max-xl:col-start-2">
            <HomeCalendar />
            <section className="editorial-panel home-explore p-5">
              <h2 className="mb-4 text-sm font-bold">{tx("在这里逛逛")}</h2>
              <div className="space-y-1">
                {[{ href: "/projects", label: "项目与学习记录", icon: FolderGit2 }, { href: "/photowall", label: "照片里的日常", icon: Camera }, { href: "/garden", label: "工具与互动实验", icon: Wrench }, { href: "/bookmark", label: "收藏的好东西", icon: BookOpen }].map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-3 py-3 text-xs text-slate-500 transition-colors hover:bg-sky-500/10 hover:text-sky-500 dark:text-slate-400"><Icon className="h-4 w-4" />{tx(label)}<ArrowUpRight className="ml-auto h-3 w-3" /></Link>
                ))}
              </div>
            </section>
            <PhotoWallPreview />
            <details className="editorial-panel p-4"><summary className="cursor-pointer text-xs font-semibold">{tx("探索入口 · 输入暗号")}</summary><div className="mt-4"><SearchBar /></div></details>
            <details className="editorial-panel p-4" onToggle={event => setDiaryOpen(event.currentTarget.open)}><summary className="cursor-pointer text-xs font-semibold">{tx("今日趣味 · 随手看看")}</summary>{diaryOpen && <div className="mt-4"><DogDiary /></div>}</details>
          </aside>
        </div>
        <details className="editorial-panel mt-8 p-5"><summary className="cursor-pointer text-sm font-semibold">{tx("小站数据与运行信息")}</summary><div className="mt-5"><SiteDashboard /></div></details>
        <p className="mt-10 text-center text-xs tracking-widest text-slate-500 dark:text-slate-400">{tx("慢慢记录，让平凡的日子有迹可循。")}</p>
        </div>
      </div>
    </div>
  );
}
