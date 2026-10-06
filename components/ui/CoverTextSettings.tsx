"use client";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import type { AppearancePreferences } from "@/lib/appearance";
import { useTranslation } from "@/lib/i18n";

export default function CoverTextSettings() {
  const { preferences, change } = useAppearance();
  const { tx } = useTranslation();
  return <section className="appearance-group" aria-label={tx("语言与入站动画")}>
    <h3>{tx("语言与入站动画")}</h3>
    <label className="appearance-label">{tx("界面语言")}<select aria-label={tx("界面语言")} value={preferences.language} onChange={e => change({ language: e.target.value as AppearancePreferences["language"] })}><option value="zh">{tx("简体中文")}</option><option value="en">English</option><option value="ja">日本語</option></select></label>
    <p className="appearance-help">{tx("切换网站界面，文章正文和内容名称保留原文。")}</p>
    <label className="appearance-label">{tx("首页副标题语言")}<select aria-label={tx("首页副标题语言")} value={preferences.subtitleLanguage} onChange={e => change({ subtitleLanguage: e.target.value as AppearancePreferences["subtitleLanguage"] })}><option value="auto">{tx("跟随界面")}</option><option value="zh">{tx("简体中文")}</option><option value="en">English</option><option value="ja">日本語</option></select></label>
    <label className="appearance-label">{tx("副标题效果")}<select aria-label={tx("副标题效果")} value={preferences.subtitleEffect} onChange={e => change({ subtitleEffect: e.target.value as AppearancePreferences["subtitleEffect"] })}><option value="typewriter">{tx("逐字打字")}</option><option value="fade">{tx("柔和淡入")}</option><option value="rise">{tx("轻盈上浮")}</option><option value="static">{tx("静态文字")}</option></select></label>
    <p className="appearance-help">{tx("淡入和上浮每 5 秒换一句；暂停界面动画时显示静态文字。")}</p>
    <button className="appearance-switch w-full" role="switch" aria-checked={preferences.welcomeEnabled} onClick={() => change({ welcomeEnabled: !preferences.welcomeEnabled })}><span>{tx("入站欢迎动画")}</span><span>{tx(preferences.welcomeEnabled ? "启用" : "停用")}</span></button>
    <p className="appearance-help">{tx("开启后每次浏览器会话显示一次；关闭后直接进入页面，也可在欢迎画面右上角跳过。")}</p>
  </section>;
}
