"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useSyncExternalStore,
  ReactNode,
} from "react";
import { siteConfig } from "@/siteConfig";
import { validHeroMediaUrl } from "@/lib/appearance";
import { getSiteConfig } from "@/app/api/site-config";
import {
  readBlogAppearanceDefaults,
  shouldApplyBlogDefaults,
} from "@/lib/blog-appearance-defaults";

interface BackgroundContextType {
  bgImage: string;
  bgBlur: number;
  setBgImage: (img: string) => void;
  setBgBlur: (blur: number) => void;
  resetBackground: (value?: { image: string; blur: number }) => void;
  getBackgroundRevision: () => number;
}

const BackgroundContext = createContext<BackgroundContextType>({
  bgImage: "",
  bgBlur: 0,
  setBgImage: () => {},
  setBgBlur: () => {},
  resetBackground: () => {},
  getBackgroundRevision: () => 0,
});

export function useBackground() {
  return useContext(BackgroundContext);
}

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  return mounted ? (
    <BrowserBackgroundProvider>{children}</BrowserBackgroundProvider>
  ) : null;
}

function subscribeToHydration() {
  return () => {};
}

function BrowserBackgroundProvider({ children }: { children: ReactNode }) {
  const defaults = useRef(readBlogAppearanceDefaults(null).background);
  const changed = useRef({ image: false, blur: false });
  const revision = useRef(0);
  const [bgImage, setImage] = useState(() => {
    const savedImg = localStorage.getItem("bg-image");
    return savedImg && validHeroMediaUrl(savedImg)
      ? savedImg
      : siteConfig.bgImages[siteConfig.bgImages.length - 1];
  });
  const [bgBlur, setBlur] = useState(() => {
    const saved = localStorage.getItem("bg-blur");
    return saved === null || !Number.isFinite(Number(saved))
      ? 20
      : Math.min(20, Math.max(0, Number(saved)));
  });

  useEffect(() => {
    let active = true;
    getSiteConfig()
      .then((config) => {
        if (!active) return;
        defaults.current = readBlogAppearanceDefaults(
          config.blogAppearanceDefaults,
        ).background;
        try {
          if (
            shouldApplyBlogDefaults(
              !!localStorage.getItem("bg-image"),
              changed.current.image,
            )
          )
            setImage(defaults.current.image);
          if (
            shouldApplyBlogDefaults(
              localStorage.getItem("bg-blur") !== null,
              changed.current.blur,
            )
          )
            setBlur(defaults.current.blur);
        } catch {
          /* Keep personal background when storage is unavailable. */
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const setBgImage = (image: string) => {
    if (!validHeroMediaUrl(image)) return;
    changed.current.image = true;
    revision.current += 1;
    setImage(image);
    try {
      localStorage.setItem("bg-image", image);
    } catch {
      /* Session preference remains usable. */
    }
  };
  const setBgBlur = (blur: number) => {
    if (!Number.isFinite(blur)) return;
    changed.current.blur = true;
    revision.current += 1;
    const next = Math.min(20, Math.max(0, blur));
    setBlur(next);
    try {
      localStorage.setItem("bg-blur", String(next));
    } catch {
      /* Session preference remains usable. */
    }
  };

  return (
    <BackgroundContext.Provider
      value={{
        bgImage,
        bgBlur,
        setBgImage,
        setBgBlur,
        getBackgroundRevision: () => revision.current,
        resetBackground: (value = defaults.current) => {
          revision.current += 1;
          changed.current = { image: true, blur: true };
          setImage(value.image);
          setBlur(value.blur);
          try {
            localStorage.removeItem("bg-image");
            localStorage.removeItem("bg-blur");
          } catch {
            /* Reset still applies to this session. */
          }
        },
      }}
    >
      {children}
    </BackgroundContext.Provider>
  );
}
