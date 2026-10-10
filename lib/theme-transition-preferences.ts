export const themeTransitionDirections = {
  "top-left": { label: "左上到右下", angle: 135, from: "100% 100%", to: "0% 0%" },
  "top-right": { label: "右上到左下", angle: 225, from: "0% 100%", to: "100% 0%" },
  "bottom-left": { label: "左下到右上", angle: 45, from: "100% 0%", to: "0% 100%" },
  "bottom-right": { label: "右下到左上", angle: 315, from: "0% 0%", to: "100% 100%" },
  top: { label: "上到下", angle: 180, from: "50% 100%", to: "50% 0%" },
  bottom: { label: "下到上", angle: 0, from: "50% 0%", to: "50% 100%" },
  left: { label: "左到右", angle: 90, from: "100% 50%", to: "0% 50%" },
  right: { label: "右到左", angle: 270, from: "0% 50%", to: "100% 50%" },
} as const;
export type ThemeTransitionDirection = keyof typeof themeTransitionDirections;

export function normalizeThemeTransition(duration: unknown, direction: unknown) {
  return {
    duration: typeof duration === "number" && Number.isFinite(duration) ? Math.round(Math.max(200, Math.min(1600, duration))) : 650,
    direction: typeof direction === "string" && Object.hasOwn(themeTransitionDirections, direction) ? direction as ThemeTransitionDirection : "top-left" as const,
  };
}
