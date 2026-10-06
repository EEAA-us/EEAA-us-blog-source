"use client";

import { useAppearance } from "@/components/providers/AppearanceProvider";
import ClickEffect from "@/components/ui/ClickEffect";
import MouseTrail from "@/components/ui/MouseTrail";
import SeasonalEffect from "@/components/ui/SeasonalEffect";
import KiraSparkle from "@/components/ui/KiraSparkle";

export default function DecorativeEffects() {
  const { reducedMotion } = useAppearance();
  if (reducedMotion) return null;
  return <><ClickEffect /><MouseTrail /><SeasonalEffect /><KiraSparkle /></>;
}
