"use client";

import { Check } from "lucide-react";
import { useMemo } from "react";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { useTranslation } from "@/lib/i18n";
import { homeCardHue, resolveHomeCardAppearance } from "@/lib/home-card-colors";
import ColorPicker from "./ColorPicker";
import { colorStyles, defaultAppearance } from "@/lib/appearance";
import { useTheme } from "@/components/providers/ThemeProvider";

export default function HomeCardColorSettings() {
  const { preferences, change } = useAppearance();
  const { tx } = useTranslation();
  const { theme } = useTheme();
  const exact = ["solid", "white", "black"].includes(preferences.homeCardColor);
  const mode = preferences.homeCardColor === "theme" ? "theme" : exact ? "solid" : "custom";
  const hex = preferences.homeCardColor === "white" ? "#ffffff" : preferences.homeCardColor === "black" ? "#000000" : preferences.homeCardHex;
  const preview = resolveHomeCardAppearance(preferences, theme === "dark");
  const hue = homeCardHue(preferences);
  const { homeCardTone, colorSpec } = preferences;
  const swatches = useMemo(() => Object.keys(colorStyles).map(value => resolveHomeCardAppearance({ ...defaultAppearance, homeCardColor: "custom", homeCardHue: hue, homeCardStyle: value as keyof typeof colorStyles, homeCardTone, colorSpec }, theme === "dark")), [hue, homeCardTone, colorSpec, theme]);

  return <div className="space-y-3">
    <h3>{tx("首页卡片配色")}</h3>
    <p className="appearance-help">{tx("只改变首页卡片，不改变全站主题")}</p>
    <div className="appearance-options" role="group" aria-label={tx("卡片配色方式")}>
      {([["theme", "跟随主题"], ["custom", "独立调色板"], ["solid", "自由选色"]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => change({ homeCardColor: value, ...(value === "custom" ? { homeCardHue: hue } : value === "solid" ? { homeCardHex: hex } : {}) })}>{tx(label)}</button>)}
    </div>
    {mode !== "theme" && <>
      {mode === "custom" ? <>
        <label className="appearance-range-label">{tx("卡片色相")}<span>{Math.round(hue)}°</span><input className="appearance-hue" aria-label={tx("卡片色相")} type="range" min="0" max="360" value={hue} onChange={event => change({ homeCardColor: "custom", homeCardHue: Number(event.target.value) })} /></label>
        <p className="appearance-label">{tx("卡片明暗")}</p>
        <div className="appearance-options" role="group" aria-label={tx("卡片明暗")}>
          {([['theme', '跟随主题'], ['light', '浅色'], ['dark', '深色']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={preferences.homeCardTone === value} onClick={() => change({ homeCardTone: value })}>{tx(label)}</button>)}
        </div>
      </> : <>
        <p className="appearance-help">{tx("自由选择准确的卡片底色，包括黑色、白色。文字自动匹配；100%不透明度时底色与色值一致。")}</p>
        <ColorPicker label="卡片底色" value={hex} onChange={homeCardHex => change({ homeCardColor: "solid", homeCardHex })} />
      </>}
        <p className="appearance-label">{tx("卡片颜色风格")}</p>
        <div className="appearance-style-grid" role="group" aria-label={tx("卡片颜色风格")}>
          {Object.entries(colorStyles).map(([value, style], styleIndex) => {
            const colorStyle = value as keyof typeof colorStyles;
            const swatch = swatches[styleIndex];
            return <button key={value} type="button" aria-pressed={preferences.homeCardStyle === value} onClick={() => change({ homeCardStyle: colorStyle })}>
              {mode === "custom" && <span className="appearance-swatch-row" aria-hidden="true">{[swatch.roles.primary, swatch.roles.secondary, swatch.roles.tertiary].map((color, index) => <span key={index} style={{ background: color }} />)}</span>}
              <span>{tx(style.label)}</span>{preferences.homeCardStyle === value && <Check className="appearance-selected-mark" size={12} aria-hidden="true" />}
            </button>;
          })}
        </div>
      {mode === "solid" && <p className="appearance-help">{tx("风格只调整按钮与链接的搭配，保留你选定的卡片底色。")}</p>}
      <div className="home-card-palette-preview" aria-label={tx("首页卡片配色预览")} style={{ background: preview.roles.card, color: preview.roles.onSurface, borderColor: preview.roles.outline }}>
        <strong>{tx("配色预览")}</strong><p style={{ color: preview.roles.muted }}>{tx("这是卡片文字的显示效果。")}</p><div className="home-card-color-sample"><i aria-hidden="true" style={{ background: preview.roles.primary }} /><span>{tx("按钮与链接颜色")}</span></div>
      </div>
    </>}
    <p className="appearance-help">{tx(mode === "theme" ? "跟随全站主题，也跟随主题色扩散。" : "独立配色优先，主题色扩散不会覆盖这里的颜色。")}</p>
  </div>;
}
