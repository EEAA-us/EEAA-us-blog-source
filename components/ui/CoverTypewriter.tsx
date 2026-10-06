"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAppearance } from "@/components/providers/AppearanceProvider";

type Step = { phrase: number; length: number; deleting: boolean };

const translatedPhrases = {
  en: ["Learning, projects, life and inspiration — a little corner of my own.", "Collecting the moments worth remembering."],
  ja: ["学び、制作、日々のひらめきを、自分だけの場所に。", "心に残る瞬間を、少しずつ集めて。"],
} as const;

export default function CoverTypewriter({ phrases: original }: { phrases: readonly string[] }) {
  const { reducedMotion, preferences } = useAppearance();
  const language = preferences.subtitleLanguage === "auto" ? preferences.language : preferences.subtitleLanguage;
  const phrases = language === "zh" ? original : translatedPhrases[language];
  const effect = preferences.subtitleEffect;
  const [step, setStep] = useState<Step>({ phrase: 0, length: 0, deleting: false });
  const longest = phrases.reduce((result, phrase) => phrase.length > result.length ? phrase : result, "");
  const current = Array.from(phrases[step.phrase] ?? "");

  useEffect(() => {
    if (reducedMotion || effect !== "typewriter" || phrases.length === 0) return;
    const length = Array.from(phrases[step.phrase] ?? "").length;
    const delay = step.deleting ? 50 : step.length === length ? 2000 : 120;
    const timer = window.setTimeout(() => {
      setStep((previous) => {
        if (previous.deleting) {
          return previous.length > 0
            ? { ...previous, length: previous.length - 1 }
            : { phrase: (previous.phrase + 1) % phrases.length, length: 0, deleting: false };
        }
        return previous.length < length
          ? { ...previous, length: previous.length + 1 }
          : { ...previous, deleting: true };
      });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [phrases, reducedMotion, step, effect]);

  useEffect(() => {
    if (reducedMotion || effect === "static" || effect === "typewriter" || phrases.length < 2) return;
    const timer = setInterval(() => setStep(previous => ({ phrase: (previous.phrase + 1) % phrases.length, length: 0, deleting: false })), 5000);
    return () => clearInterval(timer);
  }, [effect, reducedMotion, phrases]);

  if (phrases.length === 0) return null;

  return (
    <p aria-label={phrases[0]} className="cover-subtitle relative mx-auto mt-6 max-w-2xl text-sm leading-7 text-white/85 sm:text-base">
      <span aria-hidden="true" className="invisible block">{longest}</span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={`${language}-${effect}-${effect === "typewriter" ? "typing" : step.phrase}`} aria-hidden="true" lang={language === "zh" ? "zh-CN" : language} className="absolute inset-0 block"
          initial={reducedMotion || effect === "static" || effect === "typewriter" ? false : { opacity: 0, y: effect === "rise" ? 10 : 0 }}
          animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: effect === "rise" && !reducedMotion ? -8 : 0 }} transition={{ duration: reducedMotion ? 0 : .55, ease: "easeOut" }}>
          {reducedMotion || effect === "static" ? phrases[0] : effect === "typewriter" ? current.slice(0, step.length).join("") : phrases[step.phrase % phrases.length]}
          {!reducedMotion && effect === "typewriter" && <span className="ml-1 inline-block h-[1em] w-[2px] animate-pulse bg-white/90 align-[-.12em]" />}
        </motion.span>
      </AnimatePresence>
    </p>
  );
}
