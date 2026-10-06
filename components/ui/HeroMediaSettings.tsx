"use client";

import { useEffect, useState } from "react";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { defaultAppearance, validHeroMediaUrl } from "@/lib/appearance";
import { fallbackPhotoWallAlbums, loadPhotoWallAlbums } from "@/lib/photo-wall-gallery";
import { siteConfig } from "@/siteConfig";
import { useTranslation } from "@/lib/i18n";

function usableAddress(url: string) {
  return !!url && url.length <= 1500 && validHeroMediaUrl(url);
}

function SlideLibrary() {
  const { tx } = useTranslation();
  const { preferences, change } = useAppearance();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [pickerTarget, setPickerTarget] = useState<string | null>(null);
  const [pickerCategory, setPickerCategory] = useState("all");
  const [pickerSource, setPickerSource] = useState<"wall" | "builtin">("wall");
  const [wallAlbums, setWallAlbums] = useState(fallbackPhotoWallAlbums);
  const [wallStatus, setWallStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [wallRetry, setWallRetry] = useState(0);
  const fixed = preferences.heroMode === "fixed";
  const pickerOpen = pickerTarget !== null;
  useEffect(() => {
    if (!pickerOpen) return;
    let active = true;
    loadPhotoWallAlbums().then((albums) => {
      if (active) { setWallAlbums(albums); setWallStatus("ready"); }
    }, () => {
      if (active) setWallStatus("error");
    });
    return () => { active = false; };
  }, [pickerOpen, wallRetry]);
  const wallImages = wallAlbums.flatMap((album) => album.photos.map((photo, index) => ({
    url: photo.url,
    name: photo.caption.trim() || `${album.title} · 图片 ${index + 1}`,
    category: String(album.id),
  })));
  const choices = [...new Set(preferences.heroSlides)];
  const pickerImages = (pickerSource === "wall" ? wallImages : siteConfig.heroImageLibrary)
    .filter((item) => usableAddress(item.url) && (pickerCategory === "all" || item.category === pickerCategory))
    .filter((item, index, items) => items.findIndex((entry) => entry.url === item.url) === index);
  const categories = pickerSource === "wall"
    ? [["all", "全部相册"], ...wallAlbums.map((album) => [String(album.id), album.title])]
    : [["all", "全部"], ["covers", "封面图片"], ["anime", "二次元"]];
  function openPicker(target: string) {
    if (!pickerOpen) setWallStatus("loading");
    setPickerSource("wall");
    setPickerCategory("all");
    setPickerTarget(target);
    requestAnimationFrame(() => {
      const picker = document.getElementById("hero-image-picker");
      const panel = picker?.closest(".appearance-panel-body");
      if (picker && panel) panel.scrollTop += picker.getBoundingClientRect().top - panel.getBoundingClientRect().top - 12;
      picker?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    });
  }
  return <div className="hero-presets">
    <p className="appearance-help">{fixed ? tx("选择一张作为全站封面。") : tx("已选 {n} 张，按选择顺序轮播。", { n: preferences.heroSlides.length })}</p>
    <button className="hero-library-open" type="button" aria-expanded={pickerOpen} onClick={() => openPicker(fixed ? preferences.heroSlides[0] || "add" : "add")}>{tx(fixed ? "从照片墙替换封面" : "从照片墙添加图片")}</button>
    {pickerTarget !== null && <section id="hero-image-picker" className="hero-image-picker" aria-label={tx("博客图片库")}>
      <div className="hero-picker-heading"><h4>{pickerTarget === "add" ? tx("选择要加入的图片") : tx("替换第 {n} 张图片", { n: preferences.heroSlides.indexOf(pickerTarget) + 1 })}</h4><button type="button" aria-label={tx("关闭图片库")} onClick={() => setPickerTarget(null)}>{tx("关闭")}</button></div>
      <div className="appearance-options" role="group" aria-label={tx("选图来源")}>
        {([["wall", "照片墙"], ["builtin", "原有封面"]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={pickerSource === value} onClick={() => { setPickerSource(value); setPickerCategory("all"); }}>{tx(label)}</button>)}
      </div>
      <div className="appearance-options" role="group" aria-label={tx("图片库分类")}>
        {categories.map(([value, label]) => <button key={value} type="button" aria-pressed={pickerCategory === value} onClick={() => setPickerCategory(value)}>{tx(label)}</button>)}
      </div>
      {pickerSource === "wall" && wallStatus === "loading" && <p className="appearance-help" role="status">{tx("正在加载照片墙相册…")}</p>}
      {pickerSource === "wall" && wallStatus === "error" && <p className="appearance-help" role="status">{tx("站长相册暂时无法加载，仍可选择内置相册。")}{" "}<button type="button" onClick={() => { setWallStatus("loading"); setWallRetry((value) => value + 1); }}>{tx("重试")}</button></p>}
      <div className="hero-preset-grid hero-picker-grid">
        {pickerImages.map((item) => <button key={item.url} type="button" aria-label={tx("使用图片 {name}", { name: item.name })} aria-pressed={item.url === pickerTarget} onClick={() => {
          const next = [...preferences.heroSlides];
          const targetIndex = next.indexOf(pickerTarget);
          const existingIndex = next.indexOf(item.url);
          if (targetIndex >= 0) {
            next[targetIndex] = item.url;
            if (existingIndex >= 0 && existingIndex !== targetIndex) next[existingIndex] = pickerTarget;
          } else if (existingIndex < 0) {
            if (next.length >= 50) { setError(tx("最多选择 50 张图片，请先移除一些。")); return; }
            if (fixed) next.unshift(item.url); else next.push(item.url);
          }
          change({ heroSlides: next }); setError(""); setPickerTarget(null);
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.url} alt="" loading="lazy" />
          <span>{item.name}</span>
        </button>)}
      </div>
      {!pickerImages.length && <p className="appearance-help">{tx("这个相册还没有可选图片。")}</p>}
      <p className="appearance-help">{tx("{n} 张可选图片，点击即应用。替换已在轮播中的图片时交换位置。", { n: pickerImages.length })}</p>
    </section>}
    <div className="hero-preset-grid hero-slide-grid" role="group" aria-label={tx("封面图片库")}>
      {choices.map((url, index) => {
        const selected = fixed ? preferences.heroSlides[0] === url : preferences.heroSlides.includes(url);
        const builtin = siteConfig.heroImageLibrary.find((item) => item.url === url);
        const name = wallImages.find((item) => item.url === url)?.name ?? (builtin?.category === "covers" ? tx("原有封面") : builtin?.name) ?? tx("自定义图片");
        return <div key={url} className="hero-library-item">
          <button type="button" aria-label={tx("选择第 {n} 张封面：{name}", { n: index + 1, name })} aria-pressed={selected} onClick={() => {
            if (fixed) change({ heroSlides: [url, ...preferences.heroSlides.filter((item) => item !== url)] });
            else if (selected && preferences.heroSlides.length > 1) change({ heroSlides: preferences.heroSlides.filter((item) => item !== url) });
            else if (!selected && preferences.heroSlides.length < 50) change({ heroSlides: [...preferences.heroSlides, url] });
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" loading="lazy" />
            <span>{tx("第 {n} 张", { n: index + 1 })}<small>{name} · {tx(selected ? fixed ? "使用中" : "轮播中" : "点击使用")}</small></span>
          </button>
          <button className="hero-replace" type="button" aria-label={tx("替换第 {n} 张图片", { n: index + 1 })} onClick={() => openPicker(url)}>{tx("替换")}</button>
          {choices.length > 1 && <button className="hero-remove" type="button" aria-label={tx("移除第 {n} 张图片", { n: index + 1 })} onClick={() => change({ heroSlides: preferences.heroSlides.filter((item) => item !== url) })}>{tx("移除")}</button>}
        </div>;
      })}
    </div>
    <form className="hero-media-form" onSubmit={(event) => {
      event.preventDefault();
      const urls = draft.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
      if (!urls.length || urls.some((url) => !usableAddress(url) || /\.(mp4|webm)(\?|$)/i.test(url))) { setError(tx("请填写图片直链或本站图片路径，每行一张。")); return; }
      const slides = [...new Set([...preferences.heroSlides, ...urls])];
      if (slides.length > 50) { setError(tx("最多选择 50 张图片，请先移除一些。")); return; }
      change({ heroSlides: slides }); setDraft(""); setError("");
    }}>
      <label htmlFor="hero-slide-address" className="appearance-label">{tx("添加自己的图片")}</label>
      <textarea id="hero-slide-address" rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={tx("图片 HTTPS 直链或 /images/…，每行一个")} />
      <button type="submit">{tx("加入图片库")}</button>
      {error && <p role="alert" className="appearance-help">{error}</p>}
    </form>
  </div>;
}

function MediaAddress() {
  const { tx } = useTranslation();
  const { preferences, change } = useAppearance();
  const [draft, setDraft] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  return <form className="hero-media-form" onSubmit={(event) => {
    event.preventDefault();
    const url = draft.trim();
    if (!usableAddress(url)) { setError(tx("请输入素材 HTTPS 直链或本站文件路径。")); return; }
    const kind = preferences.heroMediaKind;
    if (kind === "gif" && /\.(mp4|webm)(\?|$)/i.test(url) || kind === "video" && /\.(gif|webp|png|jpg|jpeg)(\?|$)/i.test(url)) { setError(tx("地址与素材类型不一致，请切换上方的视频／动图选项。")); return; }
    const existing = preferences.heroCustomMedia.find((item) => item.url === url);
    if (!existing && preferences.heroCustomMedia.length >= 50) { setError(tx("素材库已满，请先删除一些素材。")); return; }
    const item = { id: existing?.id ?? crypto.randomUUID(), name: name.trim() || tx(kind === "video" ? "我的视频" : "我的动图"), url, kind };
    change({ heroMediaUrl: url, heroCustomMedia: [...preferences.heroCustomMedia.filter((entry) => entry.url !== url), item] });
    setDraft(""); setName(""); setError("");
  }}>
    <label htmlFor="hero-media-url" className="appearance-label">{tx("添加自己的{kind}", { kind: tx(preferences.heroMediaKind === "video" ? "视频" : "动图") })}</label>
    <input aria-label={tx("素材名称")} maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder={tx("给素材起个名字（可选）")} />
    <input id="hero-media-url" type="text" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={tx(preferences.heroMediaKind === "video" ? "MP4 / WebM 的 HTTPS 直链或 /videos/…" : "GIF / 动态 WebP 的 HTTPS 直链")} />
    <button type="submit">{tx("保存并使用")}</button>
    {error && <p role="alert" className="appearance-help">{error}</p>}
  </form>;
}

function DynamicPresets() {
  const { tx } = useTranslation();
  const { preferences, change, mediaCatalog } = useAppearance();
  const kind = preferences.heroMediaKind;
  const presets = mediaCatalog.items.filter((item) => item.kind === kind);
  const selectedUrl = preferences.heroMediaUrl || presets[0]?.url;
  const selected = presets.find((item) => item.url === selectedUrl);
  const [category, setCategory] = useState(selected?.category ?? presets[0]?.category ?? "landscape");
  const categories = mediaCatalog.categories.filter(item => presets.some(preset => preset.category === item.id));
  const activeCategory = categories.some(item => item.id === category) ? category : categories[0]?.id;
  const custom = preferences.heroCustomMedia.filter((item) => item.kind === kind);
  return <div className="hero-presets">
    <div className="appearance-options" role="group" aria-label={tx("动态封面素材分类")}>
      {categories.map(item => <button key={item.id} type="button" aria-pressed={activeCategory === item.id} onClick={() => setCategory(item.id)}>{tx(item.name)}</button>)}
    </div>
    <div className="hero-preset-grid" role="group" aria-label={tx("选择动态封面素材")}>
      {presets.filter((item) => item.category === activeCategory).map((item) => <button key={item.id} type="button" aria-label={`选择${item.name}`} aria-pressed={selected?.id === item.id} onClick={() => change({ heroMediaUrl: item.url })}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {item.poster ? <img src={item.poster} alt="" loading="lazy" /> : <span className="appearance-help">{tx(item.kind === "video" ? "循环视频" : "GIF · 循环动图")}</span>}
        <span>{item.name}<small>{selected?.id === item.id ? tx("使用中") : tx(kind === "video" ? "循环视频" : "GIF · 循环动图")}</small></span>
      </button>)}
    </div>
    {presets.length === 0 && <p className="appearance-help">{tx("暂无可选素材，可添加自定义地址。")}</p>}
    {selected && <p className="appearance-help">{tx("当前：")} {selected.name}{selected.sourceUrl && <> · <a href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">{tx("素材来源")}</a></>}{selected.licenseUrl && <> · <a href={selected.licenseUrl} target="_blank" rel="noopener noreferrer">{tx("授权说明")}</a></>}</p>}
    {custom.length > 0 && <div className="hero-custom-list" role="group" aria-label={tx("我的动态素材")}>
      <h4>{tx("我的素材")}</h4>
      {custom.map((item) => <div key={item.id}>
        <button type="button" aria-pressed={item.url === selectedUrl} onClick={() => change({ heroMediaUrl: item.url })}>{item.name}<small>{tx(item.url === selectedUrl ? "使用中" : "点击使用")}</small></button>
        <button type="button" className="hero-remove" aria-label={tx("删除素材 {name}", { name: item.name })} onClick={() => change({ heroCustomMedia: preferences.heroCustomMedia.filter((entry) => entry.id !== item.id), ...(item.url === selectedUrl ? { heroMediaUrl: "" } : {}) })}>{tx("删除")}</button>
      </div>)}
    </div>}
  </div>;
}

export default function HeroMediaSettings() {
  const { tx } = useTranslation();
  const { preferences, reducedMotion, change, mediaCatalog } = useAppearance();
  return <section className="appearance-group" aria-label={tx("全站封面")}>
    <h3>{tx("全站封面")}</h3>
    <div className="appearance-options" role="group" aria-label={tx("全站封面模式")}>
      {([["fixed", "固定图片"], ["slideshow", "自动切图"], ["animated", "动态封面"]] as const).map(([mode, label]) => <button key={mode} type="button" aria-pressed={preferences.heroMode === mode} onClick={() => change({ heroMode: mode })}>{tx(label)}</button>)}
    </div>
    <p className="appearance-help">{tx("默认每 {n} 秒自动切图。", { n: defaultAppearance.heroInterval })}{" "}<button type="button" className="hero-default-reset" onClick={() => change({ heroMode: "slideshow", heroInterval: defaultAppearance.heroInterval, heroSlides: [...defaultAppearance.heroSlides] })}>{tx("恢复默认轮播")}</button></p>
    {preferences.heroMode !== "animated" && <>
      {preferences.heroMode === "slideshow" && <label className="appearance-range-label">{tx("切换间隔")}<span>{preferences.heroInterval} {tx("秒")}</span><input aria-label={tx("封面切换间隔")} type="range" min="0.5" max="10" step="0.5" value={preferences.heroInterval} onChange={(event) => change({ heroInterval: Number(event.target.value) })} /></label>}
      <SlideLibrary />
    </>}
    {preferences.heroMode === "animated" && <>
      <div className="appearance-options mt-3" role="group" aria-label={tx("动态素材类型")}>
        {([["video", "循环视频"], ["gif", "GIF / 动态图片"]] as const).map(([kind, label]) => <button key={kind} type="button" aria-pressed={preferences.heroMediaKind === kind} onClick={() => {
          if (kind === preferences.heroMediaKind) return;
          change({ heroMediaKind: kind, heroMediaUrl: mediaCatalog.items.find((item) => item.kind === kind)?.url ?? "" });
        }}>{tx(label)}</button>)}
      </div>
      <p className="appearance-help">{tx("选择下面的素材即可播放。切换类型会选用对应的视频或真正的动图。")}</p>
      <DynamicPresets key={`presets-${preferences.heroMediaKind}`} />
      <MediaAddress key={`address-${preferences.heroMediaKind}`} />
    </>}
    {reducedMotion && <p className="appearance-help">{tx("界面动画已暂停，自动切图和动态封面也会暂停。")}</p>}
    <p className="appearance-help">{tx("首页、项目、文章、收藏等页面共用这套封面设置，保存在当前浏览器。离开首屏或切到其他浏览器标签时暂停；自定义地址需要能直接访问图片或视频文件。")}</p>
  </section>;
}
