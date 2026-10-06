"use client";

import { useMemo, useRef, useState } from "react";
import { Palette, Settings2, Bookmark, RotateCcw, X, Check, CircleOff, Sparkles, Grip, Mountain, Shapes, Flower2, MousePointerClick, MousePointer2, WandSparkles, Maximize2, Minimize2, Image as ImageIcon, LayoutGrid, Navigation, Languages } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { fallingEffects, useEffects } from "@/components/providers/EffectProvider";
import { colorStyles, coverEffects, fontStyles, textures, defaultAppearance, resolveAppearance, type AppearancePreferences } from "@/lib/appearance";
import ColorPicker from "./ColorPicker";
import SettingsPanel from "./SettingsPanel";
import HeroMediaSettings from "./HeroMediaSettings";
import CoverContours from "./CoverContours";
import AppearancePresets from "./AppearancePresets";
import CoverTextSettings from "./CoverTextSettings";
import ReadingLayoutSettings from "./ReadingLayoutSettings";
import HomeCardColorSettings from "./HomeCardColorSettings";
import { useTranslation } from "@/lib/i18n";

const textureIcons = { none: CircleOff, starlight: Sparkles, dots: Grip, topography: Mountain, geometric: Shapes, sakura: Flower2 };
const settingsCategories = [
  { id: "presets", label: "我的预设", detail: "保存 · 切换 · 管理", description: "把喜欢的外观保存成一套预设，随时恢复。", Icon: Bookmark },
  { id: "theme", label: "主题与字体", detail: "颜色 · 字体 · 明暗", description: "选择页面字体、主题色和明暗模式。", Icon: Palette },
  { id: "cover", label: "封面与图片", detail: "图库 · 视频 · 衔接", description: "设置全站封面，以及图片与正文之间的衔接。", Icon: ImageIcon },
  { id: "layout", label: "页面与背景", detail: "布局 · 壁纸 · 纹理", description: "调整内容排列、背景图片和卡片透明度。", Icon: LayoutGrid },
  { id: "motion", label: "动画与特效", detail: "交互 · 动态场景", description: "选择喜欢的装饰效果，也可以统一暂停动画。", Icon: Sparkles },
  { id: "navigation", label: "页面跳转", detail: "滚动 · 内容定位", description: "选择打开页面时如何到达内容区。", Icon: Navigation },
  { id: "language", label: "语言与入站", detail: "界面 · 副标题 · 欢迎动画", description: "选择界面语言、副标题显示方式和欢迎动画。", Icon: Languages },
] as const;

function Choices<Value extends string>({ label, value, options, onChange }: {
  label: string;
  value: Value;
  options: { value: Value; label: string }[];
  onChange: (value: Value) => void;
}) {
  const { tx } = useTranslation();
  return <div className="appearance-choice-field">
    <p className="appearance-label">{tx(label)}</p>
    <div className="appearance-options" role="group" aria-label={tx(label)}>
      {options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{tx(option.label)}</button>)}
    </div>
  </div>;
}

export default function AppearancePanel({ onClose, expanded = false, onToggleExpanded }: { onClose: () => void; expanded?: boolean; onToggleExpanded?: () => void }) {
  const { tx } = useTranslation();
  const { preferences, saved, scheme, reducedMotion, change, reset, resetting, resetError } = useAppearance();
  const { theme, setTheme } = useTheme();
  const effects = useEffects();
  const [category, setCategory] = useState<string>("theme");
  const bodyRef = useRef<HTMLDivElement>(null);
  const currentCategory = settingsCategories.find((item) => item.id === category)!;
  const { hue, colorSpec, themeColorSpread, themeColorMode, themeHex } = preferences;
  const previews = useMemo(() => themeColorMode === "free" ? [] : Object.entries(colorStyles).map(([value, style]) => ({
    value: value as AppearancePreferences["colorStyle"],
    label: style.label,
    roles: resolveAppearance({ ...defaultAppearance, hue, colorSpec, themeColorSpread, themeColorMode, themeHex, colorStyle: value as AppearancePreferences["colorStyle"] }, theme === "dark").roles,
  })), [hue, colorSpec, themeColorSpread, themeColorMode, themeHex, theme]);

  return (
    <section id="appearance-panel" aria-label={tx("外观设置")} className={`appearance-panel${expanded ? " appearance-panel-expanded" : ""}`}>
      <header className="appearance-panel-header">
        <h2 className="flex items-center gap-2 text-sm font-bold"><Settings2 size={17} />{tx("外观设置")}</h2>
        <div className="flex gap-1">
          {onToggleExpanded && <button type="button" title={tx(expanded ? "收起设置" : "展开设置")} aria-label={tx(expanded ? "收起设置" : "展开设置")} onClick={onToggleExpanded}>{expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>}
          <button type="button" title={tx("恢复外观默认值")} aria-label={tx("恢复外观默认值")} disabled={resetting} aria-busy={resetting} onClick={() => { void reset(); }}><RotateCcw size={16} /></button>
          <button type="button" title={tx("关闭外观设置")} aria-label={tx("关闭外观设置")} onClick={onClose} autoFocus><X size={17} /></button>
        </div>
      </header>
      <div className="appearance-panel-workspace">
        {expanded && <aside className="appearance-settings-sidebar">
          <p className="appearance-sidebar-label">{tx("个性化")}</p>
          <nav aria-label={tx("设置分类")}>
            {settingsCategories.map(({ id, label, detail, Icon }) => <button key={id} type="button" aria-current={category === id ? "page" : undefined} onClick={() => {
              setCategory(id);
              bodyRef.current?.scrollTo({ top: 0, behavior: "instant" });
            }}><Icon size={19} aria-hidden="true" /><span><strong>{tx(label)}</strong><small>{tx(detail)}</small></span></button>)}
          </nav>
          <p className="appearance-sidebar-save">{saved ? <Check size={15} /> : <CircleOff size={15} />}<span>{tx(saved ? "修改后自动保存" : "设置暂未保存")}</span></p>
        </aside>}
      <div className="appearance-panel-body" ref={bodyRef}>
        {expanded && <div className="appearance-category-heading"><p>{tx("外观设置")}</p><h2>{tx(currentCategory.label)}</h2><span>{tx(currentCategory.description)}</span></div>}
        <div hidden={expanded && category !== "presets"}><AppearancePresets /></div>
        <div hidden={expanded && category !== "language"}><CoverTextSettings /></div>
        <section className="appearance-group" aria-label={tx("字体风格")} hidden={expanded && category !== "theme"}>
          <h3>{tx("字体风格")}</h3>
          <p className="appearance-help">{tx("每张卡片使用对应的真实字体。点击预览全页，自动记住选择。")}</p>
          <div className="appearance-font-grid" role="group" aria-label={tx("选择页面字体")}>
            {Object.entries(fontStyles).map(([key, font]) => {
              const fontStyle = key as AppearancePreferences["fontStyle"];
              return <button key={key} type="button" aria-label={font.label} aria-pressed={preferences.fontStyle === key} onClick={() => change({ fontStyle })} style={{ fontFamily: font.family }}>
                <span className="appearance-font-label">{tx(font.label)}{preferences.fontStyle === key && <Check size={13} aria-hidden="true" />}</span>
                <span className="appearance-font-sample">山间有风，<br />生活有光。</span>
                <span className="appearance-font-name">{font.name}</span>
              </button>;
            })}
          </div>
          <p className="appearance-help">{tx("标题和正文一起切换；左上标志和代码字体保持原样。首次切换请稍候字体加载。")}</p>
          <h4 className="appearance-type-scope">{tx("首页卡片文字")}</h4>
          <label className="appearance-range-label">{tx("首页文字大小")}<span>{preferences.homeTextScale}%</span><input aria-label={tx("首页文字大小")} type="range" min="100" max="115" step="1" value={preferences.homeTextScale} onChange={event => change({ homeTextScale: Number(event.target.value) })} /></label>
          <Choices label="首页文字粗细" value={preferences.homeTextWeight} options={[{ value: "default", label: "原样" }, { value: "medium", label: "稍粗" }, { value: "bold", label: "加粗" }]} onChange={homeTextWeight => change({ homeTextWeight })} />
          <p className="appearance-help">{tx("文章正文与导航文字分别调整；文章正文最大150%，导航最大110%，封面字重独立设置。")}</p>
          <h4 className="appearance-type-scope">{tx("文章与项目正文")}</h4>
          <label className="appearance-range-label">{tx("文章正文大小")}<span>{preferences.articleTextScale}%</span><input aria-label={tx("文章正文大小")} type="range" min="100" max="150" step="1" value={preferences.articleTextScale} onChange={event => change({ articleTextScale: Number(event.target.value) })} /></label>
          <Choices label="文章正文粗细" value={preferences.articleTextWeight} options={[{ value: "default", label: "原样" }, { value: "medium", label: "稍粗" }, { value: "bold", label: "加粗" }]} onChange={articleTextWeight => change({ articleTextWeight })} />
          <h4 className="appearance-type-scope">{tx("顶部导航文字")}</h4>
          <label className="appearance-range-label">{tx("导航文字大小")}<span>{preferences.navigationTextScale}%</span><input aria-label={tx("导航文字大小")} type="range" min="100" max="110" step="1" value={preferences.navigationTextScale} onChange={event => change({ navigationTextScale: Number(event.target.value) })} /></label>
          <Choices label="导航文字粗细" value={preferences.navigationTextWeight} options={[{ value: "default", label: "原样" }, { value: "medium", label: "稍粗" }, { value: "bold", label: "加粗" }]} onChange={navigationTextWeight => change({ navigationTextWeight })} />
          <h4 className="appearance-type-scope">{tx("顶部封面文字")}</h4>
          <Choices label="封面文字粗细" value={preferences.coverTextWeight} options={[{ value: "default", label: "原样" }, { value: "medium", label: "稍粗" }, { value: "bold", label: "加粗" }]} onChange={coverTextWeight => change({ coverTextWeight })} />
          <div className="appearance-cover-type" aria-label={tx("封面字号")}>
            <p className="appearance-label">{tx("封面字号")}</p>
            <p className="appearance-help">{tx("100% 为默认大小，手机会按屏幕宽度缩放；调整对所有页面生效。")}</p>
            <label className="appearance-range-label">{tx("封面标题")}<span>{preferences.coverTitleScale}%</span><input aria-label={tx("封面标题字号")} type="range" min="70" max="140" step="5" value={preferences.coverTitleScale} onChange={event => change({ coverTitleScale: Number(event.target.value) })} /></label>
            <label className="appearance-range-label">{tx("封面副标题")}<span>{preferences.coverSubtitleScale}%</span><input aria-label={tx("封面副标题字号")} type="range" min="80" max="150" step="5" value={preferences.coverSubtitleScale} onChange={event => change({ coverSubtitleScale: Number(event.target.value) })} /></label>
          </div>
        </section>
        <section className="appearance-group" aria-label={tx("主题配色")} hidden={expanded && category !== "theme"}>
          <h3><span>{tx("主题配色")}</span><span className="appearance-color-dot" style={{ background: scheme.roles.primary }} /></h3>
          <Choices label="主题选色方式" value={preferences.themeColorMode} options={[{ value: "palette", label: "色相调色板" }, { value: "free", label: "自由选色" }]} onChange={themeColorMode => change({ themeColorMode })} />
          {preferences.themeColorMode === "free" ? <><ColorPicker label="主题基准色" value={preferences.themeHex} onChange={themeHex => change({ themeHex })} /><p className="appearance-help">{tx("以所选颜色生成全站搭配，按钮和背景会按明暗自动适配；卡片需要精确底色时，使用首页卡片自由选色。")}</p></> : <>
          <label className="appearance-label" htmlFor="appearance-hue">{tx("主题色相")}<span>{Math.round(preferences.hue)}°</span></label>
          <input id="appearance-hue" aria-label={tx("主题色相")} className="appearance-hue" type="range" min="0" max="360" step="1" value={preferences.hue} onChange={event => change({ hue: Number(event.target.value) })} />
          <p className="appearance-help">{tx("色相决定主色，颜色风格决定鲜艳程度与配色关系。先选主色，再看下面的实时预览。")}</p>
          </>}
          <p className="appearance-label">{tx("颜色风格")}</p>
          <div className="appearance-style-grid" role="group" aria-label={tx("颜色风格")}>
            {Object.entries(colorStyles).map(([value, style]) => {
              const preview = previews.find(item => item.value === value);
              return <button key={value} type="button" aria-pressed={preferences.colorStyle === value} onClick={() => change({ colorStyle: value as AppearancePreferences["colorStyle"] })}>
                {preview && <span className="appearance-swatch-row" aria-hidden="true">{[preview.roles.primary, preview.roles.secondary, preview.roles.tertiary].map((color, index) => <span key={index} style={{ background: color }} />)}</span>}
                <span>{tx(style.label)}</span>{preferences.colorStyle === value && <Check className="appearance-selected-mark" size={12} aria-hidden="true" />}
              </button>;
            })}
          </div>
          <button className="appearance-switch" type="button" role="switch" aria-label={tx("主题色扩散")} aria-checked={preferences.themeColorSpread} onClick={() => change({ themeColorSpread: !preferences.themeColorSpread })}><span>{tx("主题色扩散")}</span><span>{tx(preferences.themeColorSpread ? "开启" : "关闭")}</span></button>
          <p className="appearance-help">{tx("开启后，主题色会轻轻染入卡片、面板与页面底色；关闭则保留原来的配色。壁纸和图片不变色。")}</p>
          <p className="appearance-help">{tx("主题色扩散只影响跟随主题的区域；首页独立配色始终优先。")}</p>
          <Choices label="配色规范" value={preferences.colorSpec} options={[{ value: "2021", label: "MD3 · 2021" }, { value: "2025", label: "Expressive · 2025" }]} onChange={colorSpec => change({ colorSpec })} />
          {scheme.effectiveSpec !== preferences.colorSpec && <p className="appearance-help">{tx("此风格由颜色引擎沿用2021算法；柔和、鲜艳、表现力和中性支持2025算法。")}</p>}
          <div className="appearance-preview" aria-label={tx("实时配色预览")}>
            <div><strong>{tx("阅读与记录")}</strong><p>{tx("文字、卡片和按钮一起配色")}</p></div><span>{tx("主色")}</span>
          </div>
          <Choices label="明暗模式" value={theme} options={[{ value: "light", label: "浅色" }, { value: "dark", label: "深色" }]} onChange={setTheme} />
        </section>
        <section className="appearance-group" aria-label="页面与布局" hidden={expanded && category !== "layout"}>
          <h3>{tx("页面与布局")}</h3><HomeCardColorSettings />
          <p className="appearance-label">{tx("下方页面背景")}</p>
          <Choices label="页面背景" value={preferences.background} options={[{ value: "image", label: "背景图片" }, { value: "solid", label: "主题底色" }]} onChange={background => change({ background })} />
          <p className="appearance-help">{tx("这里设置正文区域后面的背景，不改变顶部封面。")}</p>
          {preferences.background === "image" && <SettingsPanel />}
          <Choices label="首页文章布局" value={preferences.layout} options={[{ value: "list", label: "列表" }, { value: "grid", label: "网格" }]} onChange={layout => change({ layout })} />
          <div className="appearance-style-grid appearance-textures" role="group" aria-label={tx("背景纹理")}>
            {Object.entries(textures).map(([key, label]) => {
              const texture = key as AppearancePreferences["texture"];
              const Icon = textureIcons[texture];
              return <button key={texture} type="button" aria-pressed={preferences.texture === texture} onClick={() => change({ texture })}><Icon size={18} /><span>{tx(label)}</span></button>;
            })}
          </div>
          {preferences.texture !== "none" && <label className="appearance-range-label">{tx("纹理强度")}<span>{preferences.textureOpacity}%</span><input aria-label={tx("纹理强度")} type="range" min="5" max="25" step="1" value={preferences.textureOpacity} onChange={event => change({ textureOpacity: Number(event.target.value) })} /></label>}
          <label className="appearance-range-label">{tx("卡片不透明度")}<span>{preferences.opacity}%</span><input aria-label={tx("卡片不透明度")} type="range" min="88" max="100" value={preferences.opacity} onChange={event => change({ opacity: Number(event.target.value) })} /></label>
          <p className="appearance-help">{tx("100%时卡片完全不透明；调低后才会透出下方背景。")}</p>
        </section>
        {(!expanded || category === "cover") && <HeroMediaSettings />}
        <section className="appearance-group" aria-label={tx("文章阅读")} hidden={expanded && category !== "layout"}>
          <h3>{tx("文章阅读")}</h3>
          <ReadingLayoutSettings />
          <button className="appearance-switch" type="button" role="switch" aria-label={tx("正文悬停提示线")} aria-checked={preferences.articleHoverGuide} onClick={() => change({ articleHoverGuide: !preferences.articleHoverGuide })}><span>{tx("正文悬停提示线")}</span><span>{tx(preferences.articleHoverGuide ? "开启" : "关闭")}</span></button>
          <button className="appearance-switch" type="button" role="switch" aria-label={tx("正文悬停虚线框")} aria-checked={preferences.articleHoverFrame} onClick={() => change({ articleHoverFrame: !preferences.articleHoverFrame })}><span>{tx("正文悬停虚线框")}</span><span>{tx(preferences.articleHoverFrame ? "开启" : "关闭")}</span></button>
          <p className="appearance-help">{tx("提示线与虚线框可分别开关，帮助定位当前阅读块；文章与项目正文共用。")}</p>
        </section>
        <section className="appearance-group" aria-label={tx("页面跳转")} hidden={expanded && category !== "navigation"}>
          <h3>{tx("页面跳转")}</h3>
          <Choices label="导航定位方式" value={preferences.navigationScroll} options={[{ value: "smooth", label: "平滑滚动" }, { value: "instant", label: "直接跳转" }]} onChange={navigationScroll => change({ navigationScroll })} />
          <p className="appearance-help">{tx("首页回到顶部封面，项目、文章、归档等导航直接定位到内容区。平滑滚动会自动带你滑到内容；暂停界面动画时使用直接跳转。")}</p>
        </section>
        <section className="appearance-group" aria-label={tx("游戏看板娘")} hidden={expanded && category !== "motion"}>
          <h3>{tx("游戏看板娘")}</h3>
          <Choices label="选择看板娘" value={preferences.live2dCharacter} options={[{ value: "cyrene", label: "昔涟 · Q版（Spine）" }, { value: "firefly", label: "流萤 · Q版（Live2D）" }, { value: "furina", label: "芙宁娜 · Q版（Spine）" }, { value: "march7thQ", label: "三月七 · Q版（Spine）" }, { value: "silverwolf", label: "银狼 · Q版（Spine）" }, { value: "herta", label: "黑塔 · Q版（Spine）" }, { value: "off", label: "关闭" }]} onChange={live2dCharacter => change({ live2dCharacter })} />
          <p className="appearance-help">{tx("按住宠物拖动，松开后自动保存位置；轻点宠物切换表情。")}</p>
          <button type="button" className="theme-soft-button cursor-pointer rounded-lg px-3 py-2 text-xs" onClick={() => change({ live2dPosition: null })}>{tx("重置看板娘位置")}</button>
          <p className="appearance-help">{tx("轻触角色切换表情，暂停界面动画时保持静止。手机端隐藏，选择会随预设保存。")}</p>
        </section>
        <section className="appearance-group" aria-label={tx("博客特效")} hidden={expanded && category !== "motion"}>
          <h3><span>{tx("博客特效")}</span><Sparkles size={15} aria-hidden="true" /></h3>
          <p className="appearance-help">{tx("按喜好组合轻量特效；不会挡住点击，暂停“界面动画”时会统一停止。")}</p>
          <button className="appearance-switch" type="button" role="switch" aria-label={tx("界面动画")} aria-checked={!preferences.reduceMotion} onClick={() => change({ reduceMotion: !preferences.reduceMotion })}><span>{tx("界面动画")}</span><span>{tx(preferences.reduceMotion ? "暂停" : "播放")}</span></button>
          {reducedMotion && <p className="appearance-help">{tx("动画已暂停。若系统开启了减少动态效果，博客也会尊重系统设置。")}</p>}
          <div className="appearance-effect-grid">
            {[
              { label: "点击彩屑", description: "点击处绽放彩色粒子", enabled: effects.clickEffect, toggle: effects.toggleClickEffect, Icon: MousePointerClick },
              { label: "鼠标星轨", description: "指针移动留下柔和轨迹", enabled: effects.mouseTrail, toggle: effects.toggleMouseTrail, Icon: MousePointer2 },
              { label: "文字闪光", description: "选中文字时迸发星芒", enabled: effects.sparkleEffect, toggle: effects.toggleSparkleEffect, Icon: WandSparkles },
            ].map(({ label, description, enabled, toggle, Icon }) => <button key={label} type="button" role="switch" aria-checked={enabled} onClick={toggle}>
              <span className="appearance-effect-icon"><Icon size={17} aria-hidden="true" /></span>
              <span><strong>{tx(label)}</strong><small>{tx(description)}</small></span>
              <span className="appearance-effect-state">{tx(enabled ? "启用" : "停用")}</span>
            </button>)}
          </div>
          <p className="appearance-label"><span>{tx("动态场景")}</span><span>{tx(fallingEffects[effects.fallingEffect])}</span></p>
          <div className="appearance-falling-options" role="group" aria-label={tx("选择动态场景")}>
            {Object.entries(fallingEffects).map(([value, label]) => <button key={value} type="button" aria-pressed={effects.fallingEffect === value} onClick={() => effects.setFallingEffect(value as keyof typeof fallingEffects)}>
              {value === "seasonal" && <Flower2 size={13} aria-hidden="true" />}{tx(label)}
            </button>)}
          </div>
          <p className="appearance-help">{tx("“流萤星网”会在背景中缓慢连线，并轻柔避让鼠标；其他选项保留飘落效果。")}</p>
        </section>
        <section className="appearance-group" aria-label={tx("封面衔接")} hidden={expanded && category !== "cover"}>
          <h3>{tx("封面衔接")}</h3>
          <p className="appearance-help">{tx("让封面轻轻融入正文。选择轮廓后，可继续调整移动速度、不透明度与幅度。")}</p>
          <p className="appearance-label"><span>{tx("封面衔接特效")}</span><span>{reducedMotion ? `${tx(coverEffects[preferences.coverEffect])}（${tx("已暂停")}）` : tx(coverEffects[preferences.coverEffect])}</span></p>
          <div className="appearance-contour-grid" role="group" aria-label={tx("选择封面衔接")}>
            {Object.entries(coverEffects).map(([key, label]) => <button key={key} type="button" aria-pressed={preferences.coverEffect === key} onClick={() => change({ coverEffect: key as AppearancePreferences["coverEffect"] })}>
              <span className="appearance-contour-art"><CoverContours effect={key as AppearancePreferences["coverEffect"]} preview /></span>
              <span className="appearance-contour-caption">{tx(label)}{preferences.coverEffect === key && <Check size={14} aria-hidden="true" />}</span>
            </button>)}
          </div>
          <p className="appearance-help">{tx("前景是最下方靠近正文的一层，后景是上方叠在一起的几层。两项都为0%时隐藏波浪。")}</p>
          <Choices label="后景各层的浓度" value={preferences.waveLayerStyle} options={[{ value: "layered", label: "逐层变淡" }, { value: "uniform", label: "每层相同" }]} onChange={waveLayerStyle => change({ waveLayerStyle })} />
          <p className="appearance-help">{tx(preferences.waveLayerStyle === "layered" ? "逐层变淡：后景滑块控制整体强度，越远的层越透明。" : "每层相同：每一层后景都使用滑块设定值，重叠处会更浓。前景始终单独调整。")}</p>
          <label className="appearance-range-label">{tx("移动速度")}<span>{preferences.waveSpeed}%</span><input aria-label={tx("波浪移动速度")} type="range" min="40" max="300" step="5" value={preferences.waveSpeed} onChange={event => change({ waveSpeed: Number(event.target.value) })} /></label>
          <label className="appearance-range-label">{tx("前景不透明度")}<span>{preferences.waveOpacity}%</span><input aria-label={tx("波浪前景不透明度")} type="range" min="0" max="100" step="5" value={preferences.waveOpacity} onChange={event => change({ waveOpacity: Number(event.target.value) })} /></label>
          <label className="appearance-range-label">{tx("后景不透明度")}<span>{preferences.waveBackOpacity}%</span><input aria-label={tx("波浪后景不透明度")} type="range" min="0" max="100" step="5" value={preferences.waveBackOpacity} onChange={event => change({ waveBackOpacity: Number(event.target.value) })} /></label>
          <label className="appearance-range-label">{tx("轮廓幅度")}<span>{preferences.waveAmplitude}%</span><input aria-label={tx("波浪幅度")} type="range" min="60" max="150" step="5" value={preferences.waveAmplitude} onChange={event => change({ waveAmplitude: Number(event.target.value) })} /></label>
          <label className="appearance-range-label">{tx("叠加层数")}<span>{preferences.waveLayers} {tx("层")}</span><input aria-label={tx("波浪层数")} type="range" min="1" max="5" step="1" value={preferences.waveLayers} onChange={event => change({ waveLayers: Number(event.target.value) })} /></label>
        </section>
        <footer className="appearance-settings-footer">{resetError && <p role="alert">{tx(resetError)}</p>}{resetting && <p role="status">{tx("正在读取站长默认外观…")}</p>}<p>{tx("设置自动保存于此浏览器。恢复默认会恢复站长设定的外观、封面、页面背景、明暗模式与动效。")}</p>{!saved && <p role="status">{tx("浏览器未允许保存设置，本次调整仍然有效。")}</p>}</footer>
      </div>
      </div>
    </section>
  );
}


