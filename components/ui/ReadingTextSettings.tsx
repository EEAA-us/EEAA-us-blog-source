"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, RotateCcw, Type } from "lucide-react";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { useTranslation } from "@/lib/i18n";

const weights = [
  { value: "default", label: "原样" },
  { value: "medium", label: "稍粗" },
  { value: "bold", label: "加粗" },
] as const;

export default function ReadingTextSettings() {
  const { preferences, change } = useAppearance();
  const { tx } = useTranslation();
  const [host, setHost] = useState<Element | null>(null);
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const article = document.querySelector(".reading-grid > article");
    if (!article) return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries.at(-1);
      if (!entry) return;
      setHost(document.getElementById("reading-layout-slot"));
      setVisible(entry.isIntersecting);
      if (!entry.isIntersecting) setOpen(false);
    });
    observer.observe(article);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (event.target instanceof Node && !dropdownRef.current?.contains(event.target)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); dropdownRef.current?.querySelector<HTMLButtonElement>(".reading-layout-trigger")?.focus(); } };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", escape); };
  }, [open]);

  if (!host || !visible) return null;
  return createPortal(<div ref={dropdownRef} className="reading-text-nav">
    {open && <section id="reading-text-popover" aria-label={tx("正文文字设置")} className="reading-layout-popover reading-text-popover space-y-3">
      <h2 className="text-sm font-bold">{tx("正文文字设置")}</h2>
      <div className="reading-text-size">
        <button type="button" aria-label={tx("缩小正文文字")} title={tx("缩小正文文字")} disabled={preferences.articleTextScale <= 100} onClick={() => change({ articleTextScale: Math.max(100, preferences.articleTextScale - 1) })}><Minus size={16} /></button>
        <label className="appearance-range-label">{tx("文章正文大小")}<span>{preferences.articleTextScale}%</span>
          <input aria-label={tx("文章正文大小")} type="range" min="100" max="150" step="1" value={preferences.articleTextScale} onChange={event => change({ articleTextScale: Number(event.target.value) })} />
        </label>
        <button type="button" aria-label={tx("放大正文文字")} title={tx("放大正文文字")} disabled={preferences.articleTextScale >= 150} onClick={() => change({ articleTextScale: Math.min(150, preferences.articleTextScale + 1) })}><Plus size={16} /></button>
      </div>
      <div className="appearance-options" role="group" aria-label={tx("文章正文粗细")}>
        {weights.map(({ value, label }) => <button key={value} type="button" aria-pressed={preferences.articleTextWeight === value} onClick={() => change({ articleTextWeight: value })}>{tx(label)}</button>)}
      </div>
      <button type="button" className="reading-text-reset" onClick={() => change({ articleTextScale: 100, articleTextWeight: "default" })}><RotateCcw size={14} aria-hidden="true" />{tx("恢复文字默认")}</button>
    </section>}
    <button type="button" className="reading-layout-trigger" title={tx("正文文字设置")} aria-label={tx("正文文字设置")} aria-expanded={open} aria-controls="reading-text-popover" onClick={() => setOpen(value => !value)}>
      <Type size={17} aria-hidden="true" /><span className="reading-layout-trigger-label">{tx("字号")}</span>
    </button>
  </div>, host);
}
