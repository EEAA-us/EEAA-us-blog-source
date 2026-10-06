import type { AppearancePreferences } from "./appearance";
type Effect = AppearancePreferences["coverEffect"];
// Each contour returns to its starting height and tangent, so the two tiles loop seamlessly.
export const coverContourPaths: Record<Effect, string> = {
  waves:
    "M0 50 C120 0 240 0 360 50 S600 100 720 50 C840 0 960 0 1080 50 S1320 100 1440 50",
  tide: "M0 50 C240 14 480 14 720 50 S1200 86 1440 50",
  mist: "M0 60 C100 60 160 24 300 24 S480 66 620 66 S800 36 940 36 S1200 60 1440 60",
  ribbon: "M0 55 C220 55 240 15 460 15 S700 82 920 82 S1220 55 1440 55",
};

export function coverContourLayers(layers = 3) {
  return ["far", "rear", "back", "middle", "front"].slice(
    5 - Math.max(1, Math.min(5, layers)),
  );
}
