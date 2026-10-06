"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function HomeCalendar() {
  const [today, setToday] = useState<Date | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const { language, tx } = useTranslation();

  useEffect(() => {
    const refresh = () => setToday(new Date());
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const month = today ? new Date(today.getFullYear(), today.getMonth() + monthOffset, 1) : null;
  const year = month?.getFullYear() ?? 0;
  const monthIndex = month?.getMonth() ?? 0;
  const dayCount = month ? new Date(year, monthIndex + 1, 0).getDate() : 0;
  const leadingDays = month ? (month.getDay() + 6) % 7 : 0;

  return (
    <section className="editorial-panel home-calendar p-5" aria-label={tx("日历")}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold"><CalendarDays className="h-4 w-4 text-sky-500" />{tx("日历")}</h2>
        <button type="button" onClick={() => setMonthOffset(0)} className="rounded-lg px-2 py-1 text-xs text-sky-500 hover:bg-sky-500/10">{tx("回到今天")}</button>
      </div>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" aria-label={tx("上个月")} disabled={!today} onClick={() => setMonthOffset((offset) => offset - 1)} className="rounded-lg p-2 hover:bg-sky-500/10"><ChevronLeft className="h-4 w-4" /></button>
        <p aria-live="polite" className="text-sm font-semibold tabular-nums">{month ? new Intl.DateTimeFormat(language === "en" ? "en-US" : language === "ja" ? "ja-JP" : "zh-CN", { year: "numeric", month: "long" }).format(month) : tx("加载日历…")}</p>
        <button type="button" aria-label={tx("下个月")} disabled={!today} onClick={() => setMonthOffset((offset) => offset + 1)} className="rounded-lg p-2 hover:bg-sky-500/10"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <table className="w-full table-fixed text-center text-xs" aria-label={month ? new Intl.DateTimeFormat(language === "en" ? "en-US" : language === "ja" ? "ja-JP" : "zh-CN", { year: "numeric", month: "long" }).format(month) : tx("公历")}>
        <thead><tr>{(language === "en" ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : language === "ja" ? ["月", "火", "水", "木", "金", "土", "日"] : ["一", "二", "三", "四", "五", "六", "日"]).map((day) => <th key={day} scope="col" className="h-8 font-normal text-slate-500 dark:text-slate-400">{day}</th>)}</tr></thead>
        <tbody>{Array.from({ length: 6 }, (_, week) => <tr key={week}>{Array.from({ length: 7 }, (_, weekday) => {
          const day = week * 7 + weekday - leadingDays + 1;
          const visible = !!month && day > 0 && day <= dayCount;
          const isToday = visible && monthOffset === 0 && day === today?.getDate();
          return <td key={weekday} className="h-8"><span aria-current={isToday ? "date" : undefined} className={`inline-flex h-7 w-7 items-center justify-center rounded-full tabular-nums ${isToday ? "bg-sky-500/15 font-bold text-sky-600 ring-1 ring-sky-500/40 dark:text-sky-400" : ""}`}>{visible ? day : ""}</span></td>;
        })}</tr>)}</tbody>
      </table>
      <p className="mt-3 border-t border-slate-200/50 pt-3 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">{today ? today.toLocaleDateString(language === "en" ? "en-US" : language === "ja" ? "ja-JP" : "zh-CN", { month: "long", day: "numeric", weekday: "long" }) : tx("今天")} · {tx("留一点时间记录")}</p>
    </section>
  );
}
