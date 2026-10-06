"use client";

import { useState } from "react";
import { Bookmark, Check, Trash2, RefreshCw } from "lucide-react";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useBackground } from "@/components/providers/BackgroundProvider";
import { useEffects, fallingEffects, type FallingEffect } from "@/components/providers/EffectProvider";
import { normalizeAppearance, validHeroMediaUrl, coverEffects, fontStyles, type AppearancePreferences } from "@/lib/appearance";
import { siteConfig } from "@/siteConfig";
import { useTranslation } from "@/lib/i18n";

const storageKey = "site-appearance-presets-v1";
interface Snapshot {
  appearance: AppearancePreferences;
  theme: "light" | "dark";
  background: { image: string; blur: number };
  effects: { clickEffect: boolean; mouseTrail: boolean; sparkleEffect: boolean; fallingEffect: FallingEffect };
}
interface Preset { id: string; name: string; snapshot: Snapshot }

function readPresets(): Preset[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (!Array.isArray(stored)) return [];
    return stored.slice(0, 20).flatMap((item): Preset[] => {
      if (!item || typeof item.id !== "string" || typeof item.name !== "string" || !item.name.trim() || !item.snapshot) return [];
      const source = item.snapshot;
      const effects = source.effects ?? {};
      const blur = source.background?.blur;
      return [{ id: item.id.slice(0, 100), name: item.name.trim().slice(0, 40), snapshot: {
        appearance: normalizeAppearance(source.appearance),
        theme: source.theme === "dark" ? "dark" : "light",
        background: { image: typeof source.background?.image === "string" && validHeroMediaUrl(source.background.image) ? source.background.image : siteConfig.bgImages.at(-1)!, blur: typeof blur === "number" && Number.isFinite(blur) ? Math.min(20, Math.max(0, blur)) : 20 },
        effects: { clickEffect: effects.clickEffect === true, mouseTrail: effects.mouseTrail === true, sparkleEffect: effects.sparkleEffect === true, fallingEffect: typeof effects.fallingEffect === "string" && Object.hasOwn(fallingEffects, effects.fallingEffect) ? effects.fallingEffect : "none" },
      } }];
    });
  } catch { return []; }
}

export default function AppearancePresets() {
  const { tx } = useTranslation();
  const { preferences, change } = useAppearance();
  const { theme, setTheme } = useTheme();
  const { bgImage, bgBlur, setBgImage, setBgBlur } = useBackground();
  const effects = useEffects();
  const [presets, setPresets] = useState(readPresets);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const snapshot: Snapshot = { appearance: preferences, theme, background: { image: bgImage, blur: bgBlur }, effects: { clickEffect: effects.clickEffect, mouseTrail: effects.mouseTrail, sparkleEffect: effects.sparkleEffect, fallingEffect: effects.fallingEffect } };
  const persist = (next: Preset[], success: string) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setPresets(next); setMessage(tx(success));
      return true;
    } catch { setMessage(tx("浏览器未允许保存，预设没有写入。请检查浏览器存储空间或设置。")); return false; }
  };
  const save = () => {
    const title = name.trim();
    if (!title) { setMessage(tx("先为这套设置取个名字。")); return; }
    if (presets.some(p => p.name === title)) { setMessage(tx("这个名字已有预设，请换个名字，或使用下方的更新按钮。")); return; }
    if (presets.length >= 20) { setMessage(tx("最多保存20套预设，请先删除不再使用的预设。")); return; }
    if (persist([...presets, { id: crypto.randomUUID(), name: title, snapshot }], tx("已保存「{name}」。", { name: title }))) setName("");
  };
  const apply = (preset: Preset) => {
    const data = preset.snapshot;
    change(data.appearance);
    setBgImage(data.background.image); setBgBlur(data.background.blur);
    try {
      setTheme(data.theme); effects.applyEffects(data.effects);
      setMessage(tx("已应用「{name}」。", { name: preset.name }));
    } catch { setMessage(tx("已应用预设，但浏览器未允许保存部分设置。")); }
  };
  return <section className="appearance-group appearance-presets" aria-label={tx("我的预设")}>
    <h3><span className="flex items-center gap-2"><Bookmark size={17} aria-hidden="true" />{tx("我的预设")}</span><small>{presets.length}/20</small></h3>
    <p className="appearance-help">{tx("保存当前配色、字体、封面、背景、动效和页面跳转设置，随时切回来。预设保存在此浏览器，恢复默认不会删除。")}</p>
    <form className="appearance-preset-save" onSubmit={event => { event.preventDefault(); save(); }}>
      <label className="sr-only" htmlFor="appearance-preset-name">{tx("预设名称")}</label>
      <input id="appearance-preset-name" value={name} onChange={event => setName(event.target.value)} maxLength={40} placeholder={tx("给这套设置起个名字")} />
      <button type="submit"><Bookmark size={15} aria-hidden="true" />{tx("保存为我的预设")}</button>
    </form>
    <p className="appearance-preset-message" role="status">{message}</p>
    {presets.length ? <ul className="appearance-preset-list">{presets.map(preset => <li key={preset.id}>
      <span className="appearance-preset-info"><strong>{preset.name}</strong><small>{tx(fontStyles[preset.snapshot.appearance.fontStyle].label)} · {tx(coverEffects[preset.snapshot.appearance.coverEffect])} · {tx(preset.snapshot.theme === "dark" ? "深色" : "浅色")}</small></span>
      <div className="appearance-preset-actions">
        <button type="button" onClick={() => apply(preset)} aria-label={`${tx("应用预设")} ${preset.name}`}><Check size={14} aria-hidden="true" />{tx("应用")}</button>
        <button type="button" onClick={() => persist(presets.map(p => p.id === preset.id ? { ...p, snapshot } : p), tx("已用当前设置更新「{name}」。", { name: preset.name }))} title={tx("用当前设置更新")} aria-label={`${tx("用当前设置更新预设")} ${preset.name}`}><RefreshCw size={15} /></button>
        <button type="button" onClick={() => persist(presets.filter(p => p.id !== preset.id), tx("已删除「{name}」，当前外观保持不变。", { name: preset.name }))} title={tx("删除预设")} aria-label={`${tx("删除预设")} ${preset.name}`}><Trash2 size={15} /></button>
      </div>
    </li>)}</ul> : <p className="appearance-help">{tx("还没有预设。调好喜欢的外观后，保存第一套吧。")}</p>}
  </section>;
}
