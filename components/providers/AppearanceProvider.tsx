"use client";
import { useEffects } from "./EffectProvider";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { MotionConfig } from "framer-motion";
import { useTheme } from "./ThemeProvider";
import { useBackground } from "./BackgroundProvider";
import {
  defaultAppearance,
  fontStyles,
  normalizeAppearance,
  resolveAppearance,
  type AppearancePreferences,
} from "@/lib/appearance";
import {
  prepareReadingLayoutMotion,
  prepareReadingPosition,
} from "@/lib/reading-layout-motion";
import { getSiteConfig } from "@/app/api/site-config";
import {
  readBlogAppearanceDefaults,
  shouldApplyBlogDefaults,
} from "@/lib/blog-appearance-defaults";
import {
  defaultMediaCatalog,
  readMediaCatalog,
  visibleMediaCatalog,
  type MediaCatalog,
} from "@/lib/hero-media-catalog";

import { applyLoadedAppearanceReset } from "@/lib/appearance-reset";

const storageKey = "site-appearance-v2";

function readAppearance(): AppearancePreferences {
  try {
    const current = localStorage.getItem(storageKey);
    if (current) return normalizeAppearance(JSON.parse(current));
    const legacy = JSON.parse(
      localStorage.getItem("home-appearance-v1") || "null",
    );
    const hues: Record<string, number> = {
      sky: 260,
      violet: 300,
      rose: 350,
      teal: 180,
    };
    return normalizeAppearance({
      ...legacy,
      hue: hues[legacy?.palette] ?? defaultAppearance.hue,
    });
  } catch {
    return defaultAppearance;
  }
}

function subscribeToMotion(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const AppearanceContext = createContext<{
  preferences: AppearancePreferences;
  mediaCatalog: MediaCatalog;
  saved: boolean;
  welcomeActive: boolean;
  setWelcomeActive: (active: boolean) => void;
  reducedMotion: boolean;
  scheme: ReturnType<typeof resolveAppearance>;
  change: (patch: Partial<AppearancePreferences>) => void;
  reset: () => Promise<void>;
  resetting: boolean;
  resetError: string;
} | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const siteDefaults = useRef(defaultAppearance);
  const changedDuringLoad = useRef(false);
  const revision = useRef(0);
  const resetRequest = useRef(0);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState("");
  const [catalog, setCatalog] = useState(defaultMediaCatalog);
  const [preferences, setPreferences] = useState(readAppearance);
  const [saved, setSaved] = useState(true);
  const [welcomeActive, setWelcomeActive] = useState(false);
  useEffect(() => {
    let active = true;
    getSiteConfig()
      .then((config) => {
        if (!active) return;
        setCatalog(readMediaCatalog(config.heroMediaCatalog));
        siteDefaults.current = readBlogAppearanceDefaults(
          config.blogAppearanceDefaults,
        ).preferences;
        let hasSavedPreference = true;
        try {
          hasSavedPreference = !!(
            localStorage.getItem(storageKey) ||
            localStorage.getItem("home-appearance-v1")
          );
        } catch {
          /* Keep the current session when storage cannot be read. */
        }
        if (
          shouldApplyBlogDefaults(hasSavedPreference, changedDuringLoad.current)
        ) {
          setPreferences(siteDefaults.current);
          try {
            setWelcomeActive(
              siteDefaults.current.welcomeEnabled &&
                !sessionStorage.getItem("welcome-shown"),
            );
          } catch {
            setWelcomeActive(false);
          }
        } else if (!changedDuringLoad.current) {
          try {
            setWelcomeActive(
              readAppearance().welcomeEnabled &&
                !sessionStorage.getItem("welcome-shown"),
            );
          } catch {
            setWelcomeActive(false);
          }
        }
      })
      .catch(() => {
        if (active && !changedDuringLoad.current) {
          try {
            setWelcomeActive(
              readAppearance().welcomeEnabled &&
                !sessionStorage.getItem("welcome-shown"),
            );
          } catch {
            setWelcomeActive(false);
          }
        }
      });
    return () => {
      active = false;
    };
  }, []);
  const mediaCatalog = useMemo(() => visibleMediaCatalog(catalog), [catalog]);
  const { theme, resetTheme, getThemeRevision } = useTheme();
  const { resetBackground, getBackgroundRevision } = useBackground();
  const { resetEffects, getEffectsRevision } = useEffects();
  const layoutFrame = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (layoutFrame.current !== null)
        cancelAnimationFrame(layoutFrame.current);
    },
    [],
  );
  useEffect(() => {
    document.documentElement.lang =
      preferences.language === "zh" ? "zh-CN" : preferences.language;
  }, [preferences.language]);
  const systemReducedMotion = useSyncExternalStore(
    subscribeToMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  const reducedMotion = preferences.reduceMotion || systemReducedMotion;
  const {
    hue,
    colorStyle,
    colorSpec,
    themeColorSpread,
    themeColorMode,
    themeHex,
  } = preferences;
  const scheme = useMemo(
    () =>
      resolveAppearance(
        {
          ...defaultAppearance,
          hue,
          colorStyle,
          colorSpec,
          themeColorSpread,
          themeColorMode,
          themeHex,
        },
        theme === "dark",
      ),
    [
      hue,
      colorStyle,
      colorSpec,
      themeColorSpread,
      themeColorMode,
      themeHex,
      theme,
    ],
  );
  const persist = (next: AppearancePreferences) => {
    setPreferences(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  };
  const change = (patch: Partial<AppearancePreferences>) => {
    changedDuringLoad.current = true;
    revision.current += 1;
    const next = normalizeAppearance({ ...preferences, ...patch });
    const layoutChanged =
      next.readingLayout !== preferences.readingLayout ||
      next.readingPageWidth !== preferences.readingPageWidth ||
      next.readingContentWidth !== preferences.readingContentWidth ||
      next.focusContentWidth !== preferences.focusContentWidth;
    if (layoutChanged && layoutFrame.current !== null) {
      cancelAnimationFrame(layoutFrame.current);
      layoutFrame.current = null;
    }
    const restorePosition = layoutChanged ? prepareReadingPosition() : null;
    const animate =
      layoutChanged && !reducedMotion && !next.reduceMotion
        ? prepareReadingLayoutMotion()
        : null;
    persist(next);
    if (layoutChanged)
      layoutFrame.current = requestAnimationFrame(() => {
        layoutFrame.current = null;
        restorePosition?.();
        animate?.();
      });
  };
  const reset = async () => {
    const request = ++resetRequest.current;
    setResetting(true);
    setResetError("");
    try {
      await applyLoadedAppearanceReset(
        () =>
          getSiteConfig().then((config) =>
            readBlogAppearanceDefaults(config.blogAppearanceDefaults),
          ),
        () =>
          `${resetRequest.current}:${revision.current}:${getThemeRevision()}:${getBackgroundRevision()}:${getEffectsRevision()}`,
        (defaults) => {
          siteDefaults.current = defaults.preferences;
          change(defaults.preferences);
          resetTheme(defaults.theme);
          resetBackground(defaults.background);
          resetEffects(defaults.effects);
        },
      );
    } catch {
      if (request === resetRequest.current)
        setResetError("默认外观读取失败，当前设置已保留，请重试。");
    } finally {
      if (request === resetRequest.current) setResetting(false);
    }
  };
  const style = {
    ...scheme.variables,
    "--panel-opacity": `${preferences.opacity}%`,
    "--texture-opacity": preferences.textureOpacity / 100,
    "--cover-transition-motion": !reducedMotion ? "running" : "paused",
    "--wave-duration-back": `${14 / (preferences.waveSpeed / 100)}s`,
    "--wave-duration-middle": `${10 / (preferences.waveSpeed / 100)}s`,
    "--wave-duration-front": `${7 / (preferences.waveSpeed / 100)}s`,
    "--wave-opacity": preferences.waveOpacity / 100,
    "--wave-back-opacity": preferences.waveBackOpacity / 100,
    "--wave-softness": "0px",
    "--page-font": fontStyles[preferences.fontStyle].family,
    "--home-text-scale": preferences.homeTextScale / 100,
    "--home-text-weight": preferences.homeTextWeight === "bold" ? 600 : 500,
    "--home-heading-weight": preferences.homeTextWeight === "bold" ? 800 : 700,
    "--article-text-scale": preferences.articleTextScale / 100,
    "--article-text-weight":
      preferences.articleTextWeight === "bold"
        ? 700
        : preferences.articleTextWeight === "medium"
          ? 500
          : "inherit",
    "--navigation-text-scale": preferences.navigationTextScale / 100,
    "--navigation-text-weight":
      preferences.navigationTextWeight === "bold"
        ? 700
        : preferences.navigationTextWeight === "medium"
          ? 600
          : "inherit",
    "--cover-text-weight":
      preferences.coverTextWeight === "bold"
        ? 700
        : preferences.coverTextWeight === "medium"
          ? 600
          : "inherit",
    "--cover-title-scale": preferences.coverTitleScale / 100,
    "--cover-subtitle-scale": preferences.coverSubtitleScale / 100,
    "--page-heading-weight": fontStyles[preferences.fontStyle].headingWeight,
    "--reading-page-width": `${preferences.readingPageWidth}px`,
    "--reading-content-width": `${preferences.readingContentWidth}px`,
    "--focus-content-width": `${preferences.focusContentWidth}px`,
  } as CSSProperties;

  return (
    <AppearanceContext.Provider
      value={{
        preferences,
        mediaCatalog,
        saved,
        welcomeActive,
        setWelcomeActive,
        reducedMotion,
        scheme,
        change,
        reset,
        resetting,
        resetError,
      }}
    >
      <MotionConfig reducedMotion={reducedMotion ? "always" : "user"}>
        <div
          className="site-appearance"
          data-home-text-weight={preferences.homeTextWeight}
          data-card-opacity={preferences.opacity}
          data-wave-opacity={preferences.waveOpacity}
          data-wave-layer-style={preferences.waveLayerStyle}
          data-reduce-motion={reducedMotion}
          data-font-style={preferences.fontStyle}
          data-reading-layout={preferences.readingLayout}
          data-article-text-weight={preferences.articleTextWeight}
          data-navigation-text-weight={preferences.navigationTextWeight}
          data-cover-text-weight={preferences.coverTextWeight}
          style={style}
        >
          {children}
        </div>
      </MotionConfig>
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error("AppearanceProvider is required");
  return context;
}
