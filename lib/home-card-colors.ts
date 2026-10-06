import { resolveAppearance, type AppearancePreferences } from "./appearance";
import { hexToHsl } from "./color-picker";
export const homeCardColorOptions = [
  { id: "theme", name: "跟随主题", hex: "#6750a4", hue: 260 },
  { id: "rose", name: "玫瑰", hex: "#e85d75", hue: 350 },
  { id: "mint", name: "薄荷", hex: "#22a58a", hue: 165 },
  { id: "sky", name: "晴空", hex: "#3687c8", hue: 210 },
  { id: "lavender", name: "薰衣草", hex: "#9168c5", hue: 285 },
  { id: "sand", name: "暖沙", hex: "#bd8142", hue: 38 },
  { id: "slate", name: "石板", hex: "#68788c", hue: 235 },
  { id: "white", name: "纯白", hex: "#ffffff", hue: 0 },
  { id: "black", name: "纯黑", hex: "#000000", hue: 0 },
  { id: "custom", name: "自定义配色", hex: "#6750a4", hue: 260 },
] as const;

export type HomeCardColor = typeof homeCardColorOptions[number]["id"];

// Reuse semantic palettes independently of exact RGB; bound the live-color cache.
const exactPalettes = new Map<string, ReturnType<typeof resolveAppearance>>();

export function homeCardHue(preferences: AppearancePreferences): number {
  return preferences.homeCardColor === "custom" ? preferences.homeCardHue : homeCardColorOptions.find(option => option.id === preferences.homeCardColor)?.hue ?? 260;
}

export function resolveHomeCardAppearance(preferences: AppearancePreferences, dark: boolean) {
  const mode = preferences.homeCardColor;
  if (mode === "theme") return resolveAppearance(preferences, dark);
  const pure = mode === "white" || mode === "black" || mode === "solid";
  const color = mode === "white" ? "#ffffff" : mode === "black" ? "#000000" : preferences.homeCardHex;
  const channels = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16) / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  const luminance = channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  const localDark = pure ? luminance < .179 : preferences.homeCardTone === "theme" ? dark : preferences.homeCardTone === "dark";
  const selected = hexToHsl(color);
  const hue = pure ? Math.round(selected.s > 0 ? selected.h : preferences.homeCardHue) : homeCardHue(preferences);
  const key = `${preferences.colorSpec}:${localDark}:${preferences.homeCardStyle}:${hue}`;
  if (pure && !exactPalettes.has(key)) {
    if (exactPalettes.size >= 48) exactPalettes.delete(exactPalettes.keys().next().value!);
    exactPalettes.set(key, resolveAppearance({ ...preferences, themeColorMode: "palette", hue, colorStyle: preferences.homeCardStyle, themeColorSpread: false }, localDark));
  }
  const base = pure ? exactPalettes.get(key)! : resolveAppearance({ ...preferences, themeColorMode: "palette", hue, colorStyle: preferences.homeCardStyle, themeColorSpread: true }, localDark);
  const result = { ...base, roles: { ...base.roles }, variables: { ...base.variables } };
  if (pure) {
    result.roles.card = color;
    result.variables["--ui-card"] = color;
    result.roles.onSurface = localDark ? "#ffffff" : "#000000";
    result.roles.muted = result.roles.onSurface;
    result.variables["--ui-on-surface"] = result.roles.onSurface;
    result.variables["--ui-muted"] = result.roles.muted;
  }
  return result;
}
