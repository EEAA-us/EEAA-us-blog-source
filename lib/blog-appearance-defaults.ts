import { defaultAppearance, normalizeAppearance, validHeroMediaUrl } from "./appearance";
import { siteConfig } from "../siteConfig";

export const blogFallingEffects={none:"关闭",seasonal:"随季节",sakura:"樱花",ginkgo:"银杏",snow:"落雪",stardust:"星屑",feathers:"羽毛",constellation:"流萤星网"} as const;
export const defaultBlogEffects={clickEffect:true,mouseTrail:false,sparkleEffect:false,fallingEffect:"none" as keyof typeof blogFallingEffects};
export function readBlogAppearanceDefaults(value: unknown) {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const preferences = source.preferences && typeof source.preferences === "object" && !Array.isArray(source.preferences) ? source.preferences : {};
  const background = source.background && typeof source.background === "object" ? source.background as Record<string, unknown> : {};
  const effects=source.effects && typeof source.effects==="object" ? source.effects as Record<string,unknown> : {};
  return {
    effects:{clickEffect:typeof effects.clickEffect==="boolean"?effects.clickEffect:true,mouseTrail:effects.mouseTrail===true,sparkleEffect:effects.sparkleEffect===true,fallingEffect:typeof effects.fallingEffect==="string" && Object.hasOwn(blogFallingEffects,effects.fallingEffect)?effects.fallingEffect as keyof typeof blogFallingEffects:"none" as keyof typeof blogFallingEffects},
    preferences: normalizeAppearance({ ...defaultAppearance, ...preferences, live2dPosition: null }),
    theme: source.theme === "light" || source.theme === "dark" ? source.theme : "system" as "light" | "dark" | "system",
    background: {
      image: typeof background.image === "string" && validHeroMediaUrl(background.image) ? background.image : siteConfig.bgImages[siteConfig.bgImages.length - 1],
      blur: typeof background.blur === "number" && Number.isFinite(background.blur) ? Math.min(20, Math.max(0, background.blur)) : 20,
    },
  };
}

// A site default may initialize a new visitor, but never replace a visitor's choice.
export function shouldApplyBlogDefaults(hasSavedPreference: boolean, changedDuringLoad: boolean) {
  return !hasSavedPreference && !changedDuringLoad;
}
