// One short viewport reveal per explicit click; never a continuous canvas loop.
import { normalizeThemeTransition, themeTransitionDirections } from "./theme-transition-preferences";
import { themeLiveMediaMasks } from "./theme-live-media";
let stopCurrent: (() => void) | null = null;

export function stopThemeTransition() {
  stopCurrent?.();
  stopCurrent = null;
}

export function runThemeTransition(apply: () => void, reducedMotion: boolean, options: { duration?: number; direction?: string } = {}) {
  stopThemeTransition();
  if (reducedMotion) { apply(); return; }
  const root = document.documentElement;
  const { duration, direction } = normalizeThemeTransition(options.duration, options.direction);
  const reveal = themeTransitionDirections[direction];
  const properties = {
    "--theme-transition-duration": `${duration}ms`,
    "--theme-reveal-angle": `${reveal.angle}deg`,
    "--theme-reveal-from": reveal.from,
    "--theme-reveal-to": reveal.to,
    ...(typeof document.startViewTransition === "function" ? themeLiveMediaMasks(document, window.innerWidth, window.innerHeight) : {}),
  };
  for (const [key, value] of Object.entries(properties)) root.style.setProperty(key, value);
  let cancelled = false;
  const timer: { current?: ReturnType<typeof setTimeout> } = {};
  let transition: ViewTransition | undefined;
  const stop = () => {
    if (cancelled) return;
    cancelled = true;
    clearTimeout(timer.current);
    transition?.skipTransition();
    root.classList.remove("theme-switching", "theme-wiping");
    for (const key of Object.keys(properties)) root.style.removeProperty(key);
    if (stopCurrent === stop) stopCurrent = null;
  };
  stopCurrent = stop;
  root.classList.add("theme-switching");
  if (typeof document.startViewTransition === "function") {
    root.classList.add("theme-wiping");
    try {
      transition = document.startViewTransition(() => { if (!cancelled) apply(); });
      void transition.ready.catch(() => {});
      void transition.finished.then(stop, stop);
      return;
    } catch { root.classList.remove("theme-wiping"); }
  }
  // Older browsers retain the color fade and the same theme/storage behavior.
  apply();
  timer.current = setTimeout(stop, duration + 50);
}
