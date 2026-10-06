"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { siteConfig } from "@/siteConfig";

const SESSION_KEY = "welcome-shown";

function getTimeGreeting() {
  const now = new Date();
  const h = now.getHours();
  const period = h < 6 ? "凌晨" : h < 9 ? "早上" : h < 12 ? "上午" : h < 14 ? "中午" : h < 18 ? "下午" : "晚上";
  const hour = h <= 12 ? h : h - 12;
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const min = now.getMinutes();
  return `${now.getFullYear()}年${m}月${d}日${period}${hour}点${min > 0 ? min + "分" : ""}，很高兴与你相遇`;
}

export default function WelcomeScreen() {
  const { preferences, reducedMotion, welcomeActive, setWelcomeActive, mediaCatalog } = useAppearance();
  const selectedMediaUrl = preferences.heroMediaUrl || mediaCatalog.items.find((item) => item.kind === preferences.heroMediaKind)?.url || "";
  const preset = mediaCatalog.items.find((item) => item.url === selectedMediaUrl);
  const customMedia = preferences.heroCustomMedia.find((item) => item.url === selectedMediaUrl);
  const animatedKind = customMedia?.kind ?? preset?.kind ?? preferences.heroMediaKind;
  const customVideo = preferences.heroMode === "animated" && animatedKind === "video" && !preset;
  const welcomeImage = preferences.heroMode === "animated"
    ? preset?.poster || siteConfig.heroImage
    : preferences.heroSlides[0] || siteConfig.heroImage;

  useEffect(() => {
    if (!welcomeActive) return;
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* Still allow entering when storage is unavailable. */ }
    const timer = setTimeout(() => setWelcomeActive(false), preferences.welcomeEnabled ? 3500 : 0);
    return () => clearTimeout(timer);
  }, [welcomeActive, setWelcomeActive, preferences.welcomeEnabled]);

  return (
    <AnimatePresence>
      {welcomeActive && (
        <motion.div
          className="fixed inset-0 z-[99999] flex items-center justify-center"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1, pointerEvents: "auto" }}
          exit={{ opacity: 0, pointerEvents: "none" }}
          transition={{ duration: reducedMotion ? 0 : 0.8, ease: "easeInOut" }}
        >
          <button type="button" onClick={() => setWelcomeActive(false)} className="absolute right-5 top-5 z-20 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm text-white backdrop-blur-sm hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white">{preferences.language === "en" ? "Skip intro →" : preferences.language === "ja" ? "スキップ →" : "跳过动画 →"}</button>
          {/* 背景 */}
          <motion.div
            className="absolute inset-0 bg-slate-950"
            exit={reducedMotion ? undefined : { scale: 1.1 }}
            transition={{ duration: reducedMotion ? 0 : 0.8, ease: "easeInOut" }}
          />
          <motion.div
            data-welcome-background
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `url(${welcomeImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(20px)",
            }}
            initial={reducedMotion ? false : { scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.2 }}
            transition={{ duration: reducedMotion ? 0 : 1.2 }}
          >
            {customVideo && <video src={selectedMediaUrl} muted playsInline preload="auto" className="absolute inset-0 h-full w-full object-cover" />}
          </motion.div>

          {/* 内容 */}
          <div className="relative z-10 text-center px-6">
            {/* 欢迎主标题 */}
            <motion.div
              className="flex items-center justify-center space-x-1 mb-4"
              initial={reducedMotion ? false : { opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1, transition: { delay: 0, duration: reducedMotion ? 0 : 0.5 } }}
              transition={{ delay: reducedMotion ? 0 : 0.8, duration: reducedMotion ? 0 : 0.7, ease: "easeOut" }}
            >
              <span className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight" style={{ fontFamily: "'Noto Serif SC', serif" }}>
                {preferences.language === "en" ? "Wow! It really is you!" : preferences.language === "ja" ? "わあ！本当に君だ！" : "哇！真的是你啊！"}
              </span>
            </motion.div>

            {/* 时间问候 */}
            <motion.p
              className="text-sm md:text-base text-slate-500 tracking-wider"
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { delay: 0, duration: reducedMotion ? 0 : 0.5 } }}
              transition={{ delay: reducedMotion ? 0 : 1.5, duration: reducedMotion ? 0 : 0.6 }}
            >
              {preferences.language === "zh" ? getTimeGreeting() : `${new Intl.DateTimeFormat(preferences.language === "en" ? "en-US" : "ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date())} · ${preferences.language === "en" ? "Glad you're here." : "お会いできてうれしいです。"}`}
            </motion.p>

            {/* 装饰线 */}
            <motion.div
              className="mx-auto mt-8 h-px bg-gradient-to-r from-transparent via-sky-500/40 to-transparent"
              initial={reducedMotion ? false : { width: 0, opacity: 0 }}
              animate={{ width: 160, opacity: 1 }}
              exit={{ width: 0, opacity: 0, transition: { delay: 0, duration: reducedMotion ? 0 : 0.5 } }}
              transition={{ delay: reducedMotion ? 0 : 2.2, duration: reducedMotion ? 0 : 0.6 }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

