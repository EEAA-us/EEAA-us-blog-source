"use client";

import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Grid2X2, ArrowLeft, X, Search, Flame, TvMinimalPlay, CloudSun, Ticket, Images, Gamepad2, Monitor, Hand } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const SearchApp = lazy(() => import("./toolbox/SearchApp"));
const HotBoardApp = lazy(() => import("./toolbox/HotBoardApp"));
const BilibiliHotApp = lazy(() => import("./toolbox/BilibiliHotApp"));
const WeatherApp = lazy(() => import("./toolbox/WeatherApp"));
const FortuneDrawApp = lazy(() => import("./toolbox/FortuneDrawApp"));
const RandomImageApp = lazy(() => import("./toolbox/RandomImageApp"));
const GameImagesApp = lazy(() => import("./toolbox/GameImagesApp"));
const Random4kApp = lazy(() => import("./toolbox/Random4kApp"));
const RPSApp = lazy(() => import("./toolbox/RPSApp"));

interface AppDef {
  id: string;
  name: string;
  icon: React.ReactNode;
  accent: string;
  component: React.LazyExoticComponent<React.ComponentType>;
}

const allApps: AppDef[] = [
  { id: "search", name: "智能搜索", icon: <Search />, accent: "#788ba5", component: SearchApp },
  { id: "hotboard", name: "全网热榜", icon: <Flame />, accent: "#b08a73", component: HotBoardApp },
  { id: "bilibilihot", name: "B站热榜", icon: <TvMinimalPlay />, accent: "#799fa6", component: BilibiliHotApp },
  { id: "weather", name: "天气", icon: <CloudSun />, accent: "#899cad", component: WeatherApp },
  { id: "fortune", name: "抽签", icon: <Ticket />, accent: "#ad9b77", component: FortuneDrawApp },
  { id: "randomimage", name: "随机图片", icon: <Images />, accent: "#839d88", component: RandomImageApp },
  { id: "genshin", name: "游戏图片", icon: <Gamepad2 />, accent: "#9989aa", component: GameImagesApp },
  { id: "random4k", name: "4K图片", icon: <><Monitor /><span className="toolbox-4k-mark">4K</span></>, accent: "#858ea7", component: Random4kApp },
  { id: "rps", name: "猜拳", icon: <Hand />, accent: "#ac8c99", component: RPSApp },
];

export default function Toolbox({ navigationTextStyle }: { navigationTextStyle?: React.CSSProperties }) {
  const { tx } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const currentApp = allApps.find((app) => app.id === activeApp);

  const close = () => {
    setIsOpen(false);
    setActiveApp(null);
  };

  useEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();
    const outside = (event: MouseEvent) => {
      if (document.querySelector("[data-toolbox-portal]")) return;
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("[data-toolbox-portal]")) {
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", keyboard);
    window.addEventListener("close-toolbox", close);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", keyboard);
      window.removeEventListener("close-toolbox", close);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => { if (isOpen) close(); else setIsOpen(true); }}
        aria-expanded={isOpen}
        aria-controls="toolbox-panel"
        style={navigationTextStyle}
        className="toolbox-trigger flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
      >
        <Grid2X2 className="h-[18px] w-[18px]" aria-hidden="true" />
        <span className="whitespace-nowrap">{tx("小功能")}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="toolbox-panel"
            role="dialog"
            aria-label={currentApp ? tx(currentApp.name) : tx("小功能")}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16 }}
            className="toolbox-panel"
          >
            <div className="toolbox-header">
              <div className="flex min-w-0 items-center gap-2">
                {currentApp ? (
                  <button type="button" onClick={() => setActiveApp(null)} aria-label={tx("返回小功能")} className="toolbox-header-button">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                ) : <Grid2X2 className="h-5 w-5 text-[var(--ui-primary)]" />}
                <h2 className="text-sm font-bold">{currentApp ? tx(currentApp.name) : tx("小功能")}</h2>
              </div>
              <button ref={closeRef} type="button" onClick={() => { close(); triggerRef.current?.focus(); }} aria-label={tx("关闭小功能")} className="toolbox-header-button">
                <X className="h-4 w-4" />
              </button>
            </div>

            {currentApp ? (
              <div className="toolbox-app-body">
                <Suspense fallback={<div className="py-12 text-center text-sm text-[var(--ui-muted)]">{tx("加载中...")}</div>}>
                  <currentApp.component />
                </Suspense>
              </div>
            ) : (
              <div className="toolbox-grid-body">
                <p className="mb-4 text-xs text-[var(--ui-muted)]">{tx("查资讯、看图片，或放松一下")}</p>
                <div className="grid grid-cols-3 gap-2">
                  {allApps.map((app) => (
                    <button key={app.id} type="button" onClick={() => setActiveApp(app.id)} className="toolbox-app-button">
                      <span className="toolbox-app-icon" aria-hidden="true" style={{ "--tool-icon-tone": app.accent } as React.CSSProperties}>{app.icon}</span>
                      <span className="text-xs font-medium">{tx(app.name)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
