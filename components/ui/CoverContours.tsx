import type { AppearancePreferences } from "@/lib/appearance";

type Effect = AppearancePreferences["coverEffect"];

import { coverContourPaths, coverContourLayers } from "@/lib/cover-contours";
import "@/lib/cover-contour-preview.css";

export default function CoverContours({ effect, layers = 3, preview = false }: { effect: Effect; layers?: number; preview?: boolean }) {
  return <div className={preview ? "cover-contour-preview" : "page-cover-transition"} data-effect={effect} aria-hidden="true">
    <div className="cover-wave-layers">
    {coverContourLayers(layers).map(layer => (
      <svg key={layer} className={`page-cover-wave page-cover-wave-${layer}`} viewBox="0 0 2880 100" preserveAspectRatio="none" focusable="false">
        {[0, 1440].map(offset => <path key={offset} transform={`translate(${offset} 0)`} d={`${coverContourPaths[effect]} V${preview ? 100 : 1000} H0 Z`} fill="currentColor" />)}
      </svg>
    ))}
    </div>
  </div>;
}
