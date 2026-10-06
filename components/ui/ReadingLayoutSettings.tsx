"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Columns3, Maximize2, SlidersHorizontal, BookOpen, Check } from "lucide-react";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { useTranslation } from "@/lib/i18n";

const modes = [
  { id: "default", label: "原始布局", description: "默认采用较宽的正文区域，保留两侧栏。", Icon: Maximize2 },
  { id: "narrow", label: "窄屏阅读", description: "收窄页面宽度，保留正文与两侧栏。", Icon: Columns3 },
  { id: "custom", label: "自定义宽度", description: "分别调整页面和正文的最大宽度。", Icon: SlidersHorizontal },
  { id: "focus", label: "专注阅读", description: "隐藏两侧工具栏，正文居中；项目目录仍可展开。", Icon: BookOpen },
] as const;

export default function ReadingLayoutSettings({ shortcut = false }: { shortcut?: boolean }) {
  const { preferences, change } = useAppearance();
  const { tx } = useTranslation();
  const [host, setHost] = useState<Element | null>(null);
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!shortcut) return;
    const article = document.querySelector(".reading-grid > article");
    if (!article) return;
    const observer = new IntersectionObserver((entries) => {
      // Rapid scrolls can batch several records for this single observed article.
      const entry = entries.at(-1);
      if (!entry) return;
      setHost(document.getElementById("reading-layout-slot"));
      setVisible(entry.isIntersecting);
      if (!entry.isIntersecting) setOpen(false);
    });
    observer.observe(article);
    return () => observer.disconnect();
  }, [shortcut]);
  useEffect(() => {
    if (!open) return;
    dropdownRef.current?.querySelector<HTMLButtonElement>('.reading-mode-options button[aria-pressed="true"]')?.focus({ preventScroll: true });
    const closeOutside = (event: PointerEvent) => { if (event.target instanceof Node && !dropdownRef.current?.contains(event.target)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); dropdownRef.current?.querySelector<HTMLButtonElement>(".reading-layout-trigger")?.focus(); } };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const selected = modes.find(mode => mode.id === preferences.readingLayout)!;
  const focus = preferences.readingLayout === "focus";
  const contentWidth = focus ? preferences.focusContentWidth : preferences.readingContentWidth;
  const controls = <>
    <div className="reading-mode-options" role="group" aria-label={tx("阅读布局模式")}>
      {modes.map(({ id, label, description, Icon }) => <button type="button" key={id} aria-pressed={preferences.readingLayout === id} title={tx(description)} onClick={() => change({ readingLayout: id })}>
        <Icon size={17} aria-hidden="true" /><span>{tx(label)}</span>{preferences.readingLayout === id && <Check size={13} aria-hidden="true" />}
      </button>)}
    </div>
    <p className="appearance-help">{tx(selected.description)}</p>
    {preferences.readingLayout === "custom" && <label className="appearance-range-label">{tx("阅读页面最大宽度")}<span>{preferences.readingPageWidth}px</span>
      <input aria-label={tx("阅读页面最大宽度")} type="range" min="1100" max="1920" step="4" value={preferences.readingPageWidth} onChange={event => change({ readingPageWidth: Number(event.target.value) })} />
    </label>}
    {(preferences.readingLayout === "custom" || preferences.readingLayout === "focus") && <label className="appearance-range-label">{tx("正文最大宽度")}<span>{contentWidth}px</span>
      <input aria-label={tx("正文最大宽度")} type="range" min="640" max={focus ? 1440 : 1120} step="16" value={contentWidth} onChange={event => change(focus ? { focusContentWidth: Number(event.target.value) } : { readingContentWidth: Number(event.target.value) })} />
    </label>}
    <p className="appearance-help">{tx("文章与项目正文共用，自动保存在此浏览器；小屏幕自动适配。")}</p>
  </>;
  if (!shortcut) return <div className="space-y-3">{controls}</div>;
  return host && visible ? createPortal(<div ref={dropdownRef} className="reading-layout-nav">
    {open && <section id="reading-layout-popover" aria-label={tx("阅读布局")} className="reading-layout-popover space-y-3">{controls}</section>}
    <button type="button" className="reading-layout-trigger" title={tx("阅读布局")} aria-label={tx("阅读布局")} aria-expanded={open} aria-controls="reading-layout-popover" onClick={() => setOpen(value => !value)}>
      <SlidersHorizontal size={17} aria-hidden="true" /><span className="reading-layout-trigger-label">{tx("阅读布局")}</span>
    </button>
  </div>, host) : null;
}
