export const themeTransitionDirections = {
  // Move only between the fully transparent/opaque edges of the 3x, 45–55% mask.
  "top-left": { label: "左上到右下", angle: 135, from: "82.5% 82.5%", to: "17.5% 17.5%" },
  "top-right": { label: "右上到左下", angle: 225, from: "17.5% 82.5%", to: "82.5% 17.5%" },
  "bottom-left": { label: "左下到右上", angle: 45, from: "82.5% 17.5%", to: "17.5% 82.5%" },
  "bottom-right": { label: "右下到左上", angle: 315, from: "17.5% 17.5%", to: "82.5% 82.5%" },
  top: { label: "上到下", angle: 180, from: "50% 82.5%", to: "50% 17.5%" },
  bottom: { label: "下到上", angle: 0, from: "50% 17.5%", to: "50% 82.5%" },
  left: { label: "左到右", angle: 90, from: "82.5% 50%", to: "17.5% 50%" },
  right: { label: "右到左", angle: 270, from: "17.5% 50%", to: "82.5% 50%" },
} as const;
export type ThemeTransitionDirection = keyof typeof themeTransitionDirections;

export function normalizeThemeTransition(duration: unknown, direction: unknown) {
  return {
    duration: typeof duration === "number" && Number.isFinite(duration) ? Math.round(Math.max(200, Math.min(1600, duration))) : 1000,
    direction: typeof direction === "string" && Object.hasOwn(themeTransitionDirections, direction) ? direction as ThemeTransitionDirection : "top-left" as const,
  };
}
