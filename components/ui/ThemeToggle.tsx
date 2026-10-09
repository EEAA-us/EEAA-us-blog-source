"use client";

import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { useTranslation } from "@/lib/i18n";
import { runThemeTransition, stopThemeTransition } from "@/lib/theme-transition";

export default function ThemeToggle({ style }: { style?: React.CSSProperties }) {
  const { theme, setTheme } = useTheme();
  const { reducedMotion } = useAppearance();
  const { tx } = useTranslation();
  const desiredTheme = useRef(theme);
  useEffect(() => { desiredTheme.current = theme; }, [theme]);
  useEffect(() => stopThemeTransition, []);

  const toggle = () => {
    const target = desiredTheme.current === "dark" ? "light" : "dark";
    desiredTheme.current = target;
    runThemeTransition(() => flushSync(() => setTheme(target)), reducedMotion);
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
