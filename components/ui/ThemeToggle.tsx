"use client";

import { useEffect, useRef } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { useTranslation } from "@/lib/i18n";

export default function ThemeToggle({ style }: { style?: React.CSSProperties }) {
  const { toggleTheme } = useTheme();
  const { reducedMotion } = useAppearance();
  const { tx } = useTranslation();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
    document.documentElement.classList.remove("theme-switching");
  }, []);

  const toggle = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    if (!reducedMotion) {
      document.documentElement.classList.add("theme-switching");
      timer.current = setTimeout(() => {
        document.documentElement.classList.remove("theme-switching");
        timer.current = null;
      }, 700);
    } else document.documentElement.classList.remove("theme-switching");
    toggleTheme();
  };

  return <button type="button" onClick={toggle} style={style}
    aria-label={tx("切换明暗主题")}
    className="theme-toggle p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/50">
    <span className="theme-toggle-icons" aria-hidden="true">
      <Sun className="theme-toggle-sun" />
      <Moon className="theme-toggle-moon" />
    </span>
  </button>;
}
