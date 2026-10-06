"use client";

import { useEffect, useRef, useState } from "react";
import { hexToHsl, hslToHex } from "@/lib/color-picker";
import { useTranslation } from "@/lib/i18n";

export default function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  const { tx } = useTranslation();
  const [draft, setDraft] = useState(() => ({ hex: value, ...hexToHsl(value) }));
  const frame = useRef<number | null>(null);
  const [emitted, setEmitted] = useState(value);
  const [incoming, setIncoming] = useState(value);
  if (value !== incoming) {
    setIncoming(value);
    if (value !== emitted) setDraft({ hex: value, ...hexToHsl(value) });
  }
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
  const update = (color: ReturnType<typeof hexToHsl>, immediate = false) => {
    const hex = hslToHex(color);
    setDraft({ ...color, hex });
    setEmitted(hex);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    if (immediate) { frame.current = null; onChange(hex); }
    else frame.current = requestAnimationFrame(() => { frame.current = null; onChange(hex); });
  };
  return <div className="appearance-color-editor">
    <div className="appearance-color-heading"><i style={{ background: draft.hex }} /><div><strong>{tx(label)}</strong><small>{tx("拖动下方滑块选色，即时预览")}</small></div><span>{draft.hex.toUpperCase()}</span></div>
    <label className="appearance-range-label">{tx("色相")}<span>{Math.round(draft.h)}°</span><input className="appearance-hue" aria-label={`${tx(label)} ${tx("色相")}`} type="range" min="0" max="360" value={draft.h} onChange={event => update({ ...draft, h: Number(event.target.value), s: draft.s || 70, l: draft.l === 0 || draft.l === 100 ? 50 : draft.l })} /></label>
    <label className="appearance-range-label">{tx("鲜艳程度")}<span>{Math.round(draft.s)}%</span><input style={{ background: `linear-gradient(to right, #888, hsl(${draft.h} 100% 50%))` }} aria-label={`${tx(label)} ${tx("鲜艳程度")}`} type="range" min="0" max="100" value={draft.s} onChange={event => update({ ...draft, s: Number(event.target.value) })} /></label>
    <label className="appearance-range-label">{tx("颜色亮度")}<span>{Math.round(draft.l)}%</span><input className="appearance-brightness" aria-label={`${tx(label)} ${tx("颜色亮度")}`} type="range" min="0" max="100" value={draft.l} onChange={event => update({ ...draft, l: Number(event.target.value) })} /></label>
    <div className="appearance-color-shortcuts" role="group" aria-label={tx("快速选择黑白")}><button type="button" onClick={() => update({ ...draft, l: 0 }, true)}><i style={{ background: "#000" }} />{tx("选黑色")}</button><button type="button" onClick={() => update({ ...draft, l: 100 }, true)}><i style={{ background: "#fff" }} />{tx("选白色")}</button></div>
    <details><summary>{tx("精确颜色代码（可选）")}</summary><form className="home-card-hex-form" onSubmit={event => { event.preventDefault(); update(hexToHsl((event.currentTarget.elements.namedItem("hex") as HTMLInputElement).value), true); }}><label>{tx("颜色代码")}<input key={value} name="hex" defaultValue={value} pattern="#[0-9a-fA-F]{6}" maxLength={7} required spellCheck={false} /></label><button type="submit">{tx("应用颜色")}</button></form></details>
  </div>;
}
