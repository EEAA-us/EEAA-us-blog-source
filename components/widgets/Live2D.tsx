"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Camera, ChevronDown, ChevronUp, ExternalLink, MessageCircle, PawPrint, Play, RefreshCw, Settings2, Smile, X } from "lucide-react";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { useTranslation } from "@/lib/i18n";

const characters = { cyrene: "昔涟", firefly: "流萤", furina: "芙宁娜", march7thQ: "三月七", silverwolf: "银狼", herta: "黑塔" } as const;
const sources = {
  cyrene: "https://github.com/yydscjy/dsh-cyrene-pet",
  firefly: "https://github.com/hhjk21/Firefly-Companion-AI-",
  furina: "https://github.com/Senkin219/GI-Character-Spine/tree/main/Fontaine/Furina/Chibi",
  march7thQ: "https://github.com/isHarryh/Hoyo-Spine-Models/tree/main/models_hksr_2y/1001",
  silverwolf: "https://github.com/isHarryh/Hoyo-Spine-Models/tree/main/models_hksr_2y/1006",
  herta: "https://github.com/isHarryh/Hoyo-Spine-Models/tree/main/models_hksr_2y/1013",
} as const;
function subscribeToDesktop(onChange: () => void) {
  const query = window.matchMedia("(min-width: 1100px)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export default function Live2D() {
  const { preferences, change, reducedMotion, welcomeActive } = useAppearance();
  const { tx } = useTranslation();
  const frame = useRef<HTMLIFrameElement>(null);
  const container = useRef<HTMLElement>(null);
  const drag = useRef<{ screenX: number; screenY: number; left: number; top: number; width: number; height: number; moved: boolean } | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const latestDragPosition = useRef<{ x: number; y: number } | null>(null);
  const [temporarilyHidden, setTemporarilyHidden] = useState(false);
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [panel, setPanel] = useState<"characters" | "tools" | null>(null);
  const [message, setMessage] = useState("");
  const [expressionNames, setExpressionNames] = useState<string[]>([]);
  const [quoteLoading, setQuoteLoading] = useState(false);
  useEffect(() => {
    if (!panel) return;
    const dismiss = (event: MouseEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setPanel(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel(null);
    };
    document.addEventListener("click", dismiss, true);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("click", dismiss, true);
      document.removeEventListener("keydown", escape);
    };
  }, [panel]);
  const bindFrame = useCallback((node: HTMLIFrameElement | null) => {
    frame.current = node;
    if (node) {
      setStatus("loading");
      setExpressionNames([]);
    }
  }, []);
  const character = preferences.live2dCharacter;
  const isCyrene = character === "cyrene";
  const isFirefly = character === "firefly";
  const isGenshinSpine = character === "furina";
  const isAnniversarySpine = character === "march7thQ" || character === "silverwolf" || character === "herta";
  const desktop = useSyncExternalStore(subscribeToDesktop, () => window.matchMedia("(min-width: 1100px)").matches, () => false);
  const position = dragPosition ?? preferences.live2dPosition;
  const command = (type: string) => {
    if (status !== "ready") { setMessage(tx("角色还在加载，请稍候")); return; }
    frame.current?.contentWindow?.postMessage({ type }, location.origin);
  };
  const quote = async () => {
    if (quoteLoading) return;
    setQuoteLoading(true);
    try {
      const response = await fetch("https://v1.hitokoto.cn", { signal: AbortSignal.timeout(4000) });
      if (!response.ok) throw new Error("Quote unavailable");
      const data = await response.json();
      if (typeof data.hitokoto !== "string" || !data.hitokoto.trim()) throw new Error("Empty quote");
      setMessage(`${data.hitokoto.slice(0, 180)}${typeof data.from === "string" ? ` —— ${data.from.slice(0, 40)}` : ""}`);
    } catch { setMessage(tx("慢慢来，今天的一小步也是进步。")); }
    finally { setQuoteLoading(false); }
  };

  const beginDrag = useCallback((screenX: number, screenY: number) => {
    const rect = container.current?.getBoundingClientRect();
    latestDragPosition.current = null;
    if (rect) drag.current = { screenX, screenY, left: rect.left, top: rect.top, width: rect.width, height: rect.height, moved: false };
  }, []);
  const moveDrag = useCallback((screenX: number, screenY: number) => {
    const start = drag.current;
    if (!start) return;
    const dx = screenX - start.screenX, dy = screenY - start.screenY;
    if (!start.moved && Math.hypot(dx, dy) < 5) return;
    start.moved = true;
    const width = Math.max(1, innerWidth - start.width - 16), height = Math.max(1, innerHeight - start.height - 88);
    latestDragPosition.current = { x: Math.min(1, Math.max(0, (start.left + dx - 8) / width)), y: Math.min(1, Math.max(0, (start.top + dy - 80) / height)) };
    setDragPosition(latestDragPosition.current);
  }, []);
  const endDrag = useCallback(() => {
    if (drag.current?.moved && latestDragPosition.current) change({ live2dPosition: latestDragPosition.current });
    drag.current = null;
    setDragPosition(null);
  }, [change]);

  useLayoutEffect(() => {
    const message = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "pet-ready") {
        setStatus("ready");
        setExpressionNames(Array.isArray(event.data.expressions) ? event.data.expressions.filter((name: unknown): name is string => typeof name === "string" && name.length > 0 && name.length <= 64).slice(0, 40) : []);
        frame.current?.contentWindow?.postMessage({ type: "pet-pause", paused: reducedMotion || welcomeActive || document.hidden }, location.origin);
      }
      if (event.data?.type === "pet-error") setStatus("error");
      if (event.data?.type === "pet-action" && typeof event.data.message === "string") setMessage(tx(event.data.message));
      if (event.data?.type === "pet-snapshot" && typeof event.data.url === "string" && event.data.url.startsWith("data:image/png;base64,")) {
        const link = document.createElement("a");
        link.href = event.data.url;
        link.download = `${character}-pet.png`;
        link.click();
        setMessage(tx("角色截图已保存"));
      }
      const { type, screenX, screenY } = event.data ?? {};
      if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return;
      if (type === "pet-drag-start") beginDrag(screenX, screenY);
      if (type === "pet-drag-move") moveDrag(screenX, screenY);
      if (type === "pet-drag-end") endDrag();
    };
    window.addEventListener("message", message);
    return () => window.removeEventListener("message", message);
  }, [reducedMotion, welcomeActive, beginDrag, moveDrag, endDrag, tx, character]);

  useEffect(() => {
    const sync = () => frame.current?.contentWindow?.postMessage({ type: "pet-pause", paused: reducedMotion || welcomeActive || document.hidden }, location.origin);
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [reducedMotion, welcomeActive, character, temporarilyHidden, retry, status, desktop]);

  if (character === "off" || !desktop) return null;
  if (temporarilyHidden) return (
    <button type="button" aria-label={tx("唤回宠物")} title={`${tx("唤回宠物")} · ${tx(characters[character])}`} className="theme-soft-button fixed bottom-5 right-3 z-40 flex cursor-pointer items-center gap-2 rounded-full px-4 py-2.5 text-sm shadow-sm" onClick={() => { setTemporarilyHidden(false); setStatus("loading"); }}>
      <PawPrint className="h-4 w-4" />{tx("唤回宠物")}
    </button>
  );
  return (
    <aside ref={container} data-live2d-pet={character} aria-label={tx("游戏看板娘")} className="fixed bottom-5 right-3 z-40 hidden w-[190px] min-[1100px]:block" style={position ? { bottom: "auto", right: "auto", left: `calc(8px + (100vw - 16px) * ${position.x})`, top: `calc(80px + (100vh - 88px) * ${position.y})`, transform: `translate(${-position.x * 100}%, ${-position.y * 100}%)` } : undefined}>
      <div className="flex items-center justify-end gap-1">
        <button type="button" title={tx("选择看板娘")} className="theme-soft-button cursor-pointer rounded-full px-3 py-2 text-xs shadow-sm" onClick={() => setPanel(value => value === "characters" ? null : "characters")} aria-expanded={panel === "characters"}>
          {tx(characters[character])}{panel === "characters" ? <ChevronUp className="ml-1 inline h-3 w-3" /> : <ChevronDown className="ml-1 inline h-3 w-3" />}
        </button>
        <button type="button" aria-label={tx("看板娘工具")} title={tx("看板娘工具")} aria-expanded={panel === "tools"} className="theme-soft-button cursor-pointer rounded-full p-2 shadow-sm" onClick={() => setPanel(value => value === "tools" ? null : "tools")}><Settings2 className="h-4 w-4" /></button>
        <button type="button" aria-label={tx("暂时隐藏看板娘")} title={tx("暂时隐藏看板娘，点击右下角可唤回")} className="theme-soft-button cursor-pointer rounded-full p-2 shadow-sm" onClick={() => { setTemporarilyHidden(true); setPanel(null); setMessage(""); }}><X className="h-4 w-4" /></button>
      </div>
      {panel && <div className={`editorial-panel absolute w-[280px] max-h-[min(330px,40vh)] overflow-y-auto p-3 text-xs ${position && position.x < 0.5 ? "left-full ml-2" : "right-full mr-2"} ${position && position.y < 0.5 ? "top-0" : "bottom-0"}`} role="group" aria-label={tx(panel === "characters" ? "选择看板娘" : "看板娘工具")}>
        {panel === "tools" && <div className="grid grid-cols-2 gap-2">
          <button type="button" className="theme-soft-button cursor-pointer rounded-lg px-2 py-2" onClick={() => command("pet-expression")}><Smile className="mx-auto mb-1 h-4 w-4" />{tx("换个表情")}</button>
          <button type="button" className="theme-soft-button cursor-pointer rounded-lg px-2 py-2" onClick={() => command("pet-motion")}><Play className="mx-auto mb-1 h-4 w-4" />{tx("播放动作")}</button>
          <button type="button" className="theme-soft-button cursor-pointer rounded-lg px-2 py-2" onClick={() => command("pet-snapshot")}><Camera className="mx-auto mb-1 h-4 w-4" />{tx("角色截图")}</button>
          <button type="button" disabled={quoteLoading} className="theme-soft-button cursor-pointer rounded-lg px-2 py-2 disabled:opacity-50" onClick={quote}><MessageCircle className="mx-auto mb-1 h-4 w-4" />{tx(quoteLoading ? "加载中…" : "来句一言")}</button>
        </div>}
        {panel === "tools" && isCyrene && <p className="mt-2 leading-5 text-slate-500">{tx("本站自制表情：开心、害羞、惊讶、失落、原表情，点击依次切换。")}</p>}
        {panel === "tools" && !isCyrene && expressionNames.length > 0 && <p className="mt-2 leading-5 text-slate-500">{tx("模型原生表情，点击依次切换。")}<br />{expressionNames.map(name => tx(name)).join("、")}</p>}
        <div className={`${panel === "tools" ? "mt-3 " : ""}grid gap-1`}>
          {Object.entries(characters).map(([id, name]) => <button key={id} type="button" aria-pressed={character === id} className="theme-soft-button cursor-pointer rounded-lg p-2 text-left" onClick={() => { if (character !== id) setStatus("loading"); change({ live2dCharacter: id as keyof typeof characters }); setMessage(""); if (panel === "characters") setPanel(null); }}>
          {tx(`${name} · Q版（${id === "firefly" ? "Live2D" : "Spine"}）`)}
          </button>)}
        </div>
        {panel === "tools" && <><button type="button" className="mt-2 w-full cursor-pointer rounded-lg py-2" onClick={() => change({ live2dPosition: null })}>{tx("重置看板娘位置")}</button>
        <a href={sources[character]} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 py-2 text-slate-500">{tx("模型来源")}<ExternalLink className="h-3 w-3" /></a></>}
      </div>}
      {message && <p role="status" className={`editorial-panel absolute right-0 w-full p-3 text-xs leading-5 ${position && position.y < 0.5 ? "top-full mt-2" : "bottom-full mb-2"}`}>{message}</p>}
      <>
        <iframe key={`${character}-${retry}`} ref={bindFrame} title={tx(characters[character])} src={isCyrene ? "/live2d/cyrene.html" : isAnniversarySpine ? `/live2d/anniversary.html?character=${character}` : isGenshinSpine ? "/live2d/genshin.html?character=furina" : `/live2d/pet.html?character=${character}`} className={`block w-full border-0 ${isCyrene || isAnniversarySpine || isGenshinSpine ? "h-[230px]" : isFirefly ? "h-[150px]" : "h-[230px]"}`} />
        {status === "loading" && <span className="pointer-events-none absolute bottom-2 left-0 w-full text-center text-xs text-slate-500" role="status">{tx("角色加载中")}</span>}
        {status === "error" && <button className="theme-soft-button w-full cursor-pointer rounded-xl p-2 text-xs" onClick={() => { setStatus("loading"); setRetry(value => value + 1); }}><RefreshCw className="mr-1 inline h-3 w-3" />{tx("角色加载失败，点击重试")}</button>}
      </>
    </aside>
  );
}
