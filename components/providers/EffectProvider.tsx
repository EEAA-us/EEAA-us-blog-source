"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";

import { getSiteConfig } from "@/app/api/site-config";
import {
  blogFallingEffects,
  defaultBlogEffects,
  readBlogAppearanceDefaults,
  shouldApplyBlogDefaults,
} from "@/lib/blog-appearance-defaults";
export const fallingEffects = blogFallingEffects;

export type FallingEffect = keyof typeof fallingEffects;

interface EffectContextType {
  clickEffect: boolean;
  mouseTrail: boolean;
  fallingEffect: FallingEffect;
  sparkleEffect: boolean;
  toggleClickEffect: () => void;
  toggleMouseTrail: () => void;
  setFallingEffect: (effect: FallingEffect) => void;
  toggleSparkleEffect: () => void;
  resetEffects: (value?: typeof defaultBlogEffects) => void;
  getEffectsRevision: () => number;
  applyEffects: (effects: {
    clickEffect: boolean;
    mouseTrail: boolean;
    fallingEffect: FallingEffect;
    sparkleEffect: boolean;
  }) => void;
}

const EffectContext = createContext<EffectContextType>({
  clickEffect: true,
  mouseTrail: false,
  fallingEffect: "none",
  sparkleEffect: false,
  toggleClickEffect: () => {},
  toggleMouseTrail: () => {},
  setFallingEffect: () => {},
  toggleSparkleEffect: () => {},
  applyEffects: () => {},
  resetEffects: () => {},
  getEffectsRevision: () => 0,
});

export function EffectProvider({ children }: { children: ReactNode }) {
  const defaults = useRef({ ...defaultBlogEffects });
  const changedDuringLoad = useRef(false);
  const revision = useRef(0);
  const [clickEffect, setClickEffect] = useState(true);
  const [mouseTrail, setMouseTrail] = useState(false);
  const [fallingEffect, setFallingEffectState] =
    useState<FallingEffect>("none");
  const [sparkleEffect, setSparkleEffect] = useState(false);

  useEffect(() => {
    let active = true;
    let saved: Record<string, string | null> = {};
    try {
      saved = Object.fromEntries(
        [
          "clickEffect",
          "mouseTrail",
          "fallingEffect",
          "seasonalEffect",
          "sparkleEffect",
        ].map((key) => [key, localStorage.getItem(key)]),
      );
    } catch {
      /* Defaults still work when storage is unavailable. */
    }
    const savedFalling =
      saved.fallingEffect && Object.hasOwn(fallingEffects, saved.fallingEffect)
        ? (saved.fallingEffect as FallingEffect)
        : saved.seasonalEffect === "true"
          ? "seasonal"
          : "none";
    queueMicrotask(() => {
      if (!active || changedDuringLoad.current) return;
      if (saved.clickEffect != null)
        setClickEffect(saved.clickEffect === "true");
      if (saved.mouseTrail != null) setMouseTrail(saved.mouseTrail === "true");
      setFallingEffectState(savedFalling);
      if (saved.sparkleEffect != null)
        setSparkleEffect(saved.sparkleEffect === "true");
    });
    getSiteConfig()
      .then((config) => {
        if (!active) return;
        defaults.current = readBlogAppearanceDefaults(
          config.blogAppearanceDefaults,
        ).effects;
        if (
          shouldApplyBlogDefaults(
            saved.clickEffect != null,
            changedDuringLoad.current,
          )
        )
          setClickEffect(defaults.current.clickEffect);
        if (
          shouldApplyBlogDefaults(
            saved.mouseTrail != null,
            changedDuringLoad.current,
          )
        )
          setMouseTrail(defaults.current.mouseTrail);
        if (
          shouldApplyBlogDefaults(
            saved.sparkleEffect != null,
            changedDuringLoad.current,
          )
        )
          setSparkleEffect(defaults.current.sparkleEffect);
        if (
          shouldApplyBlogDefaults(
            saved.fallingEffect != null || saved.seasonalEffect != null,
            changedDuringLoad.current,
          )
        )
          setFallingEffectState(defaults.current.fallingEffect);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const toggleClickEffect = () => {
    changedDuringLoad.current = true;
    revision.current += 1;
    setClickEffect((prev) => {
      localStorage.setItem("clickEffect", String(!prev));
      return !prev;
    });
  };

  const toggleMouseTrail = () => {
    changedDuringLoad.current = true;
    revision.current += 1;
    setMouseTrail((prev) => {
      localStorage.setItem("mouseTrail", String(!prev));
      return !prev;
    });
  };

  const setFallingEffect = (effect: FallingEffect) => {
    changedDuringLoad.current = true;
    revision.current += 1;
    setFallingEffectState(effect);
    localStorage.setItem("fallingEffect", effect);
    localStorage.setItem("seasonalEffect", String(effect !== "none"));
  };

  const toggleSparkleEffect = () => {
    changedDuringLoad.current = true;
    revision.current += 1;
    setSparkleEffect((prev) => {
      localStorage.setItem("sparkleEffect", String(!prev));
      return !prev;
    });
  };

  const applyEffects: EffectContextType["applyEffects"] = (effects) => {
    changedDuringLoad.current = true;
    revision.current += 1;
    setClickEffect(effects.clickEffect);
    setMouseTrail(effects.mouseTrail);
    setFallingEffectState(effects.fallingEffect);
    setSparkleEffect(effects.sparkleEffect);
    try {
      localStorage.setItem("clickEffect", String(effects.clickEffect));
      localStorage.setItem("mouseTrail", String(effects.mouseTrail));
      localStorage.setItem("fallingEffect", effects.fallingEffect);
      localStorage.setItem(
        "seasonalEffect",
        String(effects.fallingEffect !== "none"),
      );
      localStorage.setItem("sparkleEffect", String(effects.sparkleEffect));
    } catch {
      /* The reset remains active for this session when storage is unavailable. */
    }
  };

  const resetEffects = (value = defaults.current) => applyEffects(value);

  return (
    <EffectContext.Provider
      value={{
        clickEffect,
        mouseTrail,
        fallingEffect,
        sparkleEffect,
        toggleClickEffect,
        toggleMouseTrail,
        setFallingEffect,
        toggleSparkleEffect,
        applyEffects,
        resetEffects,
        getEffectsRevision: () => revision.current,
      }}
    >
      {children}
    </EffectContext.Provider>
  );
}

export function useEffects() {
  return useContext(EffectContext);
}
