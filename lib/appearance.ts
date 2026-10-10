import {
  Hct, argbFromHex, hexFromArgb, SchemeTonalSpot, SchemeVibrant, SchemeContent,
  SchemeExpressive, SchemeRainbow, SchemeFruitSalad, SchemeMonochrome,
  SchemeNeutral, SchemeFidelity,
} from "@material/material-color-utilities";
import { retiredHeroImages, siteConfig } from "../siteConfig";
import { normalizeThemeTransition, type ThemeTransitionDirection } from "./theme-transition-preferences";

// Migrate only retired bundled GIF derivatives; custom animations keep their format.
const retiredAnimatedCovers: Record<string, string> = Object.fromEntries(
  ["swing", "cottage", "columbina", "evanescia"].map(name => [`/videos/covers/${name}-loop.gif`, `/videos/covers/${name}.mp4`]),
);

export interface HeroCustomMedia {
  id: string;
  name: string;
  url: string;
  kind: "video" | "gif";
}

export const colorStyles = {
  tonalSpot: { label: "柔和", scheme: SchemeTonalSpot },
  vibrant: { label: "鲜艳", scheme: SchemeVibrant },
  content: { label: "内容", scheme: SchemeContent },
  expressive: { label: "表现力", scheme: SchemeExpressive },
  rainbow: { label: "彩虹", scheme: SchemeRainbow },
  fruitSalad: { label: "果沙", scheme: SchemeFruitSalad },
  monochrome: { label: "单色", scheme: SchemeMonochrome },
  neutral: { label: "中性", scheme: SchemeNeutral },
  fidelity: { label: "忠实", scheme: SchemeFidelity },
} as const;

export const textures = {
  none: "无纹理", starlight: "星光", dots: "点阵", topography: "等高线", geometric: "几何", sakura: "樱花",
} as const;

export const coverEffects = {
  waves: "波浪",
  tide: "舒缓长浪",
  mist: "薄雾山岚",
  ribbon: "柔弧丝带",
} as const;

export const fontStyles = {
  modern: { label: "清爽现代", name: "系统无衬线", family: 'var(--font-geist-sans), var(--font-noto-sans-sc), sans-serif', headingWeight: 600 },
  book: { label: "文艺书卷", name: "系统衬线", family: 'var(--font-noto-serif-sc), serif', headingWeight: 700 },
  rounded: { label: "温柔圆润", name: "系统圆体", family: 'var(--font-zcool-kuaile), var(--font-noto-sans-sc), sans-serif', headingWeight: 400 },
  handwritten: { label: "清晰手写", name: "系统手写", family: 'var(--font-lxgw-wenkai), var(--font-noto-serif-sc), serif', headingWeight: 700 },
} as const;

export interface AppearancePreferences {
  hue: number;
  themeColorMode: "palette" | "free";
  themeHex: string;
  colorStyle: keyof typeof colorStyles;
  colorSpec: "2021" | "2025";
  themeColorSpread: boolean;
  layout: "list" | "grid";
  background: "image" | "solid";
  texture: keyof typeof textures;
  textureOpacity: number;
  opacity: number;
  waves: boolean;
  coverEffect: keyof typeof coverEffects;
  waveSpeed: number;
  waveOpacity: number;
  waveBackOpacity: number;
  waveLayerStyle: "layered" | "uniform";
  waveAmplitude: number;
  waveLayers: number;
  reduceMotion: boolean;
  themeTransitionDuration: number;
  themeTransitionDirection: ThemeTransitionDirection;
  fontStyle: keyof typeof fontStyles;
  homeTextScale: number;
  homeCardColor: "theme" | "rose" | "mint" | "sky" | "lavender" | "sand" | "slate" | "custom" | "white" | "black" | "solid";
  homeCardHex: string;
  homeCardHue: number;
  homeCardStyle: keyof typeof colorStyles;
  homeCardTone: "theme" | "light" | "dark";
  homeTextWeight: "default" | "medium" | "bold";
  articleTextScale: number;
  articleTextWeight: "default" | "medium" | "bold";
  navigationTextScale: number;
  navigationTextWeight: "default" | "medium" | "bold";
  coverTextWeight: "default" | "medium" | "bold";
  coverTitleScale: number;
  coverSubtitleScale: number;
  heroMode: "fixed" | "slideshow" | "animated";
  heroInterval: number;
  heroMediaKind: "video" | "gif";
  heroMediaUrl: string;
  heroSlides: string[];
  heroCustomMedia: HeroCustomMedia[];
  navigationScroll: "smooth" | "instant";
  language: "zh" | "en" | "ja";
  subtitleLanguage: "auto" | "zh" | "en" | "ja";
  subtitleEffect: "typewriter" | "fade" | "rise" | "static";
  welcomeEnabled: boolean;
  articleHoverGuide: boolean;
  articleHoverFrame: boolean;
  readingLayout: "default" | "narrow" | "custom" | "focus";
  readingPageWidth: number;
  readingContentWidth: number;
  focusContentWidth: number;
  live2dCharacter: "firefly" | "furina" | "cyrene" | "march7thQ" | "silverwolf" | "herta" | "off";
  live2dPosition: { x: number; y: number } | null;
}

export const defaultAppearance: AppearancePreferences = {
  themeColorMode: "palette", themeHex: "#6750a4", hue: 260, colorStyle: "tonalSpot", colorSpec: "2025", themeColorSpread: false, layout: "list",
  background: "image", texture: "none", textureOpacity: 12, opacity: 96,
  waves: true, coverEffect: "waves", waveSpeed: 100, waveOpacity: 25, waveBackOpacity: 25, waveLayerStyle: "layered", waveAmplitude: 100, waveLayers: 3,
  reduceMotion: false, fontStyle: "rounded",
  themeTransitionDuration: 750, themeTransitionDirection: "top-left",
  homeTextScale: 100, homeTextWeight: "default", homeCardColor: "theme", homeCardHex: "#ffffff", homeCardHue: 260, homeCardStyle: "tonalSpot", homeCardTone: "theme",
  articleTextScale: 100, articleTextWeight: "default",
  navigationTextScale: 100, navigationTextWeight: "default", coverTextWeight: "default",
  coverTitleScale: 100, coverSubtitleScale: 100,
  heroMode: siteConfig.initialAppearance.heroMode, heroInterval: 4,
  heroMediaKind: siteConfig.initialAppearance.heroMediaKind,
  heroMediaUrl: siteConfig.initialAppearance.heroMediaUrl,
  heroSlides: [...siteConfig.heroImages],
  heroCustomMedia: [],
  navigationScroll: "smooth",
  language: "zh", subtitleLanguage: "auto", subtitleEffect: "typewriter", welcomeEnabled: true,
  articleHoverGuide: true, articleHoverFrame: true,
  readingLayout: "default", readingPageWidth: 1536, readingContentWidth: 896, focusContentWidth: 1120,
  live2dCharacter: siteConfig.initialAppearance.live2dCharacter,
  live2dPosition: null,
};

export function validHeroMediaUrl(value: string) {
  if (!value) return true;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

function bounded(value: unknown, minimum: number, maximum: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback;
}

export function normalizeAppearance(input: unknown): AppearancePreferences {
  const saved = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const heroSlides = Array.isArray(saved.heroSlides)
    ? [...new Set(saved.heroSlides.filter((value): value is string => typeof value === "string" && !!value.trim() && value.length <= 1500 && validHeroMediaUrl(value.trim())).map(value => value.trim()).filter(value => !retiredHeroImages.includes(value)))].slice(0, 50)
    : [...siteConfig.heroImages];
  const heroCustomMedia = Array.isArray(saved.heroCustomMedia)
    ? saved.heroCustomMedia.slice(0, 50).flatMap((entry): HeroCustomMedia[] => {
      if (!entry || typeof entry !== "object") return [];
      const item = entry as Record<string, unknown>;
      if (typeof item.id !== "string" || !item.id.trim() || item.id.length > 100 || typeof item.name !== "string" || !item.name.trim() || item.name.length > 100 || typeof item.url !== "string" || !item.url.trim() || item.url.length > 1500 || !validHeroMediaUrl(item.url.trim()) || (item.kind !== "video" && item.kind !== "gif")) return [];
      return [{ id: item.id.trim(), name: item.name.trim(), url: item.url.trim(), kind: item.kind }];
    })
    : [];
  const savedMediaUrl = typeof saved.heroMediaUrl === "string" ? saved.heroMediaUrl.trim() : defaultAppearance.heroMediaUrl;
  const replacementVideo = Object.hasOwn(retiredAnimatedCovers, savedMediaUrl) ? retiredAnimatedCovers[savedMediaUrl] : undefined;
  const heroMediaKind = replacementVideo ? "video" : saved.heroMediaKind === "gif" ? "gif" : "video";
  const heroMediaUrl = replacementVideo || savedMediaUrl;
  const themeTransition = normalizeThemeTransition(saved.themeTransitionDuration, saved.themeTransitionDirection);
  return {
    hue: bounded(saved.hue, 0, 360, defaultAppearance.hue),
    colorStyle: typeof saved.colorStyle === "string" && Object.hasOwn(colorStyles, saved.colorStyle) ? saved.colorStyle as AppearancePreferences["colorStyle"] : defaultAppearance.colorStyle,
    colorSpec: saved.colorSpec === "2021" ? "2021" : "2025",
    themeColorMode: saved.themeColorMode === "free" ? "free" : "palette",
    themeHex: typeof saved.themeHex === "string" && /^#[0-9a-f]{6}$/i.test(saved.themeHex) ? saved.themeHex.toLowerCase() : "#6750a4",
    themeColorSpread: saved.themeColorSpread === true,
    layout: saved.layout === "grid" ? "grid" : "list",
    readingLayout: saved.readingLayout === "narrow" || saved.readingLayout === "custom" || saved.readingLayout === "focus" ? saved.readingLayout : "default",
    readingPageWidth: bounded(saved.readingPageWidth, 1100, 1920, defaultAppearance.readingPageWidth),
    readingContentWidth: bounded(saved.readingContentWidth, 640, 1120, defaultAppearance.readingContentWidth),
    focusContentWidth: bounded(saved.focusContentWidth, 640, 1440, defaultAppearance.focusContentWidth),
    background: saved.background === "solid" ? "solid" : "image",
    texture: typeof saved.texture === "string" && Object.hasOwn(textures, saved.texture) ? saved.texture as AppearancePreferences["texture"] : "none",
    textureOpacity: bounded(saved.textureOpacity, 5, 25, defaultAppearance.textureOpacity),
    opacity: bounded(saved.opacity, 88, 100, defaultAppearance.opacity),
    waves: true,
    coverEffect: typeof saved.coverEffect === "string" && Object.hasOwn(coverEffects, saved.coverEffect) ? saved.coverEffect as AppearancePreferences["coverEffect"] : "waves",
    waveSpeed: bounded(saved.waveSpeed, 40, 300, defaultAppearance.waveSpeed),
    waveOpacity: bounded(saved.waveOpacity, 0, 100, defaultAppearance.waveOpacity),
    waveBackOpacity: bounded(saved.waveBackOpacity, 0, 100, bounded(saved.waveOpacity, 0, 100, defaultAppearance.waveBackOpacity)),
    waveLayerStyle: saved.waveLayerStyle === "uniform" ? "uniform" : "layered",
    waveAmplitude: bounded(saved.waveAmplitude, 60, 150, defaultAppearance.waveAmplitude),
    waveLayers: Math.round(bounded(saved.waveLayers, 1, 5, defaultAppearance.waveLayers)),
    reduceMotion: typeof saved.reduceMotion === "boolean" ? saved.reduceMotion : false,
    themeTransitionDuration: themeTransition.duration,
    themeTransitionDirection: themeTransition.direction,
    fontStyle: typeof saved.fontStyle === "string" && Object.hasOwn(fontStyles, saved.fontStyle) ? saved.fontStyle as AppearancePreferences["fontStyle"] : defaultAppearance.fontStyle,
    homeTextScale: bounded(saved.homeTextScale, 100, 115, defaultAppearance.homeTextScale),
    homeCardColor: ["rose", "mint", "sky", "lavender", "sand", "slate", "custom", "white", "black", "solid"].includes(String(saved.homeCardColor)) ? saved.homeCardColor as AppearancePreferences["homeCardColor"] : "theme",
    homeCardHex: typeof saved.homeCardHex === "string" && /^#[0-9a-f]{6}$/i.test(saved.homeCardHex) ? saved.homeCardHex.toLowerCase() : "#ffffff",
    homeCardHue: bounded(saved.homeCardHue, 0, 360, defaultAppearance.homeCardHue),
    homeCardStyle: typeof saved.homeCardStyle === "string" && Object.hasOwn(colorStyles, saved.homeCardStyle) ? saved.homeCardStyle as AppearancePreferences["homeCardStyle"] : typeof saved.colorStyle === "string" && Object.hasOwn(colorStyles, saved.colorStyle) ? saved.colorStyle as AppearancePreferences["homeCardStyle"] : defaultAppearance.homeCardStyle,
    homeCardTone: saved.homeCardTone === "light" || saved.homeCardTone === "dark" ? saved.homeCardTone : "theme",
    homeTextWeight: saved.homeTextWeight === "medium" || saved.homeTextWeight === "bold" ? saved.homeTextWeight : "default",
    articleTextScale: bounded(saved.articleTextScale, 100, 150, defaultAppearance.articleTextScale),
    articleTextWeight: saved.articleTextWeight === "medium" || saved.articleTextWeight === "bold" ? saved.articleTextWeight : "default",
    navigationTextScale: bounded(saved.navigationTextScale, 100, 110, defaultAppearance.navigationTextScale),
    navigationTextWeight: saved.navigationTextWeight === "medium" || saved.navigationTextWeight === "bold" ? saved.navigationTextWeight : "default",
    coverTextWeight: saved.coverTextWeight === "medium" || saved.coverTextWeight === "bold" ? saved.coverTextWeight : "default",
    coverTitleScale: bounded(saved.coverTitleScale, 70, 140, 100),
    coverSubtitleScale: bounded(saved.coverSubtitleScale, 80, 150, 100),
    heroMode: saved.heroMode === "fixed" || saved.heroMode === "animated" || saved.heroMode === "slideshow" ? saved.heroMode : defaultAppearance.heroMode,
    heroInterval: Math.round(bounded(saved.heroInterval, 0.5, 10, defaultAppearance.heroInterval) * 2) / 2,
    heroMediaKind,
    heroMediaUrl: heroMediaUrl.length <= 1500 && validHeroMediaUrl(heroMediaUrl) && !(heroMediaKind === "gif" ? /\.(mp4|webm)(\?|$)/i : /\.(gif|webp)(\?|$)/i).test(heroMediaUrl) ? heroMediaUrl : "",
    heroSlides,
    heroCustomMedia,
    navigationScroll: saved.navigationScroll === "instant" ? "instant" : "smooth",
    language: saved.language === "en" || saved.language === "ja" ? saved.language : "zh",
    subtitleLanguage: saved.subtitleLanguage === "zh" || saved.subtitleLanguage === "en" || saved.subtitleLanguage === "ja" ? saved.subtitleLanguage : "auto",
    subtitleEffect: saved.subtitleEffect === "fade" || saved.subtitleEffect === "rise" || saved.subtitleEffect === "static" ? saved.subtitleEffect : "typewriter",
    welcomeEnabled: typeof saved.welcomeEnabled === "boolean" ? saved.welcomeEnabled : true,
    articleHoverGuide: typeof saved.articleHoverGuide === "boolean" ? saved.articleHoverGuide : true,
    articleHoverFrame: typeof saved.articleHoverFrame === "boolean" ? saved.articleHoverFrame : typeof saved.articleHoverGuide === "boolean" ? saved.articleHoverGuide : true,
    live2dCharacter: saved.live2dCharacter === "off" ? "off" : saved.live2dCharacter === "cyrene" || saved.live2dCharacter === "furina" || saved.live2dCharacter === "march7thQ" || saved.live2dCharacter === "silverwolf" || saved.live2dCharacter === "herta" ? saved.live2dCharacter : saved.live2dCharacter === "firefly" || saved.live2dCharacter === "march7th" || saved.live2dCharacter === "robin" ? "firefly" : defaultAppearance.live2dCharacter,
    live2dPosition: saved.live2dPosition && typeof saved.live2dPosition === "object" && typeof (saved.live2dPosition as Record<string, unknown>).x === "number" && typeof (saved.live2dPosition as Record<string, unknown>).y === "number" ? {
      x: bounded((saved.live2dPosition as Record<string, unknown>).x, 0, 1, 1),
      y: bounded((saved.live2dPosition as Record<string, unknown>).y, 0, 1, 1),
    } : null,
  };
}

export function resolveAppearance(preferences: AppearancePreferences, dark: boolean) {
  const source = preferences.themeColorMode === "free" ? Hct.fromInt(argbFromHex(preferences.themeHex)) : Hct.from(preferences.hue, 60, 50);
  const Scheme = preferences.themeColorMode === "free" && /^#([0-9a-f]{2})\1\1$/i.test(preferences.themeHex) ? SchemeMonochrome : colorStyles[preferences.colorStyle].scheme;
  const scheme = new Scheme(source, dark, 0, preferences.colorSpec);
  const roles = {
    primary: hexFromArgb(scheme.primary), onPrimary: hexFromArgb(scheme.onPrimary),
    primaryContainer: hexFromArgb(scheme.primaryContainer), onPrimaryContainer: hexFromArgb(scheme.onPrimaryContainer),
    secondary: hexFromArgb(scheme.secondary), onSecondary: hexFromArgb(scheme.onSecondary),
    secondaryContainer: hexFromArgb(scheme.secondaryContainer), onSecondaryContainer: hexFromArgb(scheme.onSecondaryContainer),
    tertiary: hexFromArgb(scheme.tertiary), onTertiary: hexFromArgb(scheme.onTertiary),
    surface: hexFromArgb(scheme.surface), surfaceContainer: hexFromArgb(scheme.surfaceContainer),
    card: hexFromArgb(dark ? scheme.surfaceContainerHigh : scheme.surfaceContainerLowest),
    pageBackground: hexFromArgb(scheme.surfaceContainerLow),
    surfaceRaised: hexFromArgb(scheme.surfaceContainerHigh), onSurface: hexFromArgb(scheme.onSurface),
    muted: hexFromArgb(scheme.onSurfaceVariant), outline: hexFromArgb(scheme.outlineVariant),
  };
  if (preferences.themeColorSpread) {
    for (const key of ["surface", "surfaceContainer", "card", "pageBackground", "surfaceRaised"] as const) {
      roles[key] = `color-mix(in srgb, ${roles[key]} 86%, ${roles.primaryContainer})`;
    }
  }
  const variables: Record<string, string> = {};
  for (const [role, color] of Object.entries(roles)) {
    variables[`--ui-${role.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`] = color;
  }
  const tones = { 50: 98, 100: 95, 200: 90, 300: 80, 400: 65, 500: 50, 600: 40, 700: 30, 800: 20, 900: 10, 950: 5 };
  for (const [step, tone] of Object.entries(tones)) {
    variables[`--color-slate-${step}`] = hexFromArgb(scheme.neutralPalette.tone(tone));
    variables[`--color-sky-${step}`] = hexFromArgb(scheme.primaryPalette.tone(tone));
  }
  return { roles, variables, effectiveSpec: scheme.specVersion };
}
