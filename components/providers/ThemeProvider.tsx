"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { getSiteConfig } from "@/app/api/site-config";
import { readBlogAppearanceDefaults } from "@/lib/blog-appearance-defaults";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  resetTheme: (value?: "light" | "dark" | "system") => void;
  getThemeRevision: () => number;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
  setTheme: () => {},
  resetTheme: () => {},
  getThemeRevision: () => 0,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const defaultTheme = useRef<"light" | "dark" | "system">("system");
  const changedDuringLoad = useRef(false);
  const revision = useRef(0);
  const resolveTheme = (value: "light" | "dark" | "system"): Theme =>
    value === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : value;
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark";
    let saved: string | null = null;
    try { saved = localStorage.getItem("theme"); } catch { /* Use system theme if storage is blocked. */ }
    return saved === "dark" || saved === "light"
      ? saved
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  });

  useEffect(() => {
    let active = true;
    getSiteConfig()
      .then((config) => {
        if (!active) return;
        defaultTheme.current = readBlogAppearanceDefaults(
          config.blogAppearanceDefaults,
        ).theme;
        try {
          if (!changedDuringLoad.current && !localStorage.getItem("theme"))
            setThemeState(resolveTheme(defaultTheme.current));
        } catch {
          /* Preserve the current theme. */
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    changedDuringLoad.current = true;
    revision.current += 1;
    setThemeState(newTheme);
    try { localStorage.setItem("theme", newTheme); } catch { /* The session theme still changes. */ }
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
        getThemeRevision: () => revision.current,
        resetTheme: (value = defaultTheme.current) => {
          changedDuringLoad.current = true;
          revision.current += 1;
          setThemeState(resolveTheme(value));
          try {
            localStorage.removeItem("theme");
          } catch {
            /* Session reset remains usable. */
          }
        },
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
