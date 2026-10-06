import { reactive, readonly } from "vue";
import defaultWallpaper from "@/assets/blog-background.webp";
import { validHeroMediaUrl } from "../../../../lib/appearance";

const storageKey = "aa-ee-admin-appearance-v1";
const customImageKey = `${storageKey}-image`;
const defaults = {
  mode: "image",
  mediaKind: "video",
  videoUrl: "",
  gifUrl: "",
  videoPoster: defaultWallpaper,
  gifPoster: defaultWallpaper,
  wallpaper: defaultWallpaper,
  veil: 58,
  font: "sans",
  scale: 100,
  weight: 400
};
export const adminFontFamilies: Record<string, string> = {
  sans: '"Microsoft YaHei", "PingFang SC", sans-serif',
  serif: '"SimSun", "Songti SC", serif',
  kai: '"KaiTi", "STKaiti", serif'
};
function normalize(value: unknown) {
  const input =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const bound = (value: unknown, min: number, max: number, fallback: number) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.max(min, Math.min(max, value))
      : fallback;
  const image =
    typeof input.wallpaper === "string" ? input.wallpaper : defaults.wallpaper;
  return {
    mediaKind: input.mediaKind === "gif" ? "gif" : "video",
    videoUrl:
      typeof input.videoUrl === "string" &&
      validHeroMediaUrl(input.videoUrl) &&
      input.videoUrl
        ? input.videoUrl
        : defaults.videoUrl,
    gifUrl:
      typeof input.gifUrl === "string" &&
      validHeroMediaUrl(input.gifUrl) &&
      input.gifUrl
        ? input.gifUrl
        : defaults.gifUrl,
    videoPoster:
      typeof input.videoPoster === "string" &&
      validHeroMediaUrl(input.videoPoster) &&
      input.videoPoster
        ? input.videoPoster
        : defaults.videoPoster,
    gifPoster:
      typeof input.gifPoster === "string" &&
      validHeroMediaUrl(input.gifPoster) &&
      input.gifPoster
        ? input.gifPoster
        : defaults.gifPoster,
    mode: ["video", "image", "none"].includes(String(input.mode))
      ? String(input.mode)
      : input.wallpaper && input.wallpaper !== defaults.wallpaper
        ? "image"
        : defaults.mode,
    wallpaper:
      /^\/admin\/static\/(?:webp|png|jpg|jpeg|avif)\/[\w.-]+$/.test(image) ||
      /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image)
        ? image
        : defaults.wallpaper,
    veil: bound(input.veil, 0, 100, defaults.veil),
    font:
      typeof input.font === "string" &&
      Object.hasOwn(adminFontFamilies, input.font)
        ? input.font
        : defaults.font,
    scale: bound(input.scale, 90, 125, defaults.scale),
    weight: [400, 500, 600].includes(Number(input.weight))
      ? Number(input.weight)
      : defaults.weight
  };
}
let initial = normalize(null);
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
  if (saved?.wallpaper === "custom")
    saved.wallpaper = localStorage.getItem(customImageKey);
  initial = normalize(saved);
} catch {
  /* damaged preferences use defaults */
}
const preferences = reactive(initial);
export const adminAppearance = readonly(preferences);
function apply() {
  const style = document.documentElement.style;
  document.documentElement.dataset.adminBackground = preferences.mode;
  style.setProperty(
    "--admin-wallpaper",
    preferences.mode !== "image" ? "none" : `url("${preferences.wallpaper}")`
  );
  style.setProperty("--admin-veil", String(preferences.veil / 100));
  style.setProperty("--admin-font", adminFontFamilies[preferences.font]);
  style.setProperty("--admin-text-scale", String(preferences.scale / 100));
  style.setProperty("--admin-text-weight", String(preferences.weight));
}
export function updateAdminAppearance(patch: Partial<typeof defaults>) {
  const next = normalize({ ...preferences, ...patch });
  // Store first: a quota failure leaves the working appearance intact.
  if (
    next.wallpaper.startsWith("data:") &&
    next.wallpaper !== preferences.wallpaper
  ) {
    localStorage.setItem(customImageKey, next.wallpaper);
  }
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      ...next,
      wallpaper: next.wallpaper.startsWith("data:") ? "custom" : next.wallpaper
    })
  );
  if (!next.wallpaper.startsWith("data:"))
    localStorage.removeItem(customImageKey);
  Object.assign(preferences, next);
  apply();
}
export function resetAdminAppearance() {
  updateAdminAppearance(defaults);
}
export function initAdminAppearance() {
  apply();
}
