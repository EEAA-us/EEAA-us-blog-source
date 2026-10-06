"use client";

import { useTranslation } from "@/lib/i18n";
import RepositoryLink from "./RepositoryLink";

export default function AboutHeading() {
  const { tx } = useTranslation();
  return <>
    <h1 className="text-2xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-2 md:mb-3 transition-colors duration-700">{tx("关于我")}</h1>
    <p className="text-sm md:text-lg text-indigo-600 dark:text-indigo-400 font-bold transition-colors duration-700">{tx("很高兴在这里遇见你。")}</p>
    <RepositoryLink className="mt-3 text-sm text-indigo-600 hover:underline dark:text-indigo-400" />
  </>;
}
