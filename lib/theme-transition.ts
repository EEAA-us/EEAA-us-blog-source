// One short viewport reveal per explicit click; never a continuous canvas loop.
import { normalizeThemeTransition, themeTransitionDirections } from "./theme-transition-preferences";
import { prepareLiveThemeReveal } from "./theme-live-reveal";
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
  const live = prepareLiveThemeReveal(document, window.innerWidth, window.innerHeight);
  const properties = {
    "--theme-transition-duration": `${duration}ms`,
    "--theme-reveal-angle": `${reveal.angle}deg`,
    "--theme-reveal-from": reveal.from,
    "--theme-reveal-to": reveal.to,
  };
  for (const [key, value] of Object.entries(properties)) root.style.setProperty(key, value);
  let cancelled = false;
  let applied = false;
  const applyOnce = () => { if (!cancelled && !applied) { applied = true; apply(); } };
  const timer: { current?: ReturnType<typeof setTimeout> } = {};
  let transition: ViewTransition | undefined;
  const stop = () => {
    if (cancelled) return;
    cancelled = true;
    clearTimeout(timer.current);
    transition?.skipTransition();
    live?.stop();
    root.classList.remove("theme-switching", "theme-wiping", "theme-live-reveal");
    for (const key of Object.keys(properties)) root.style.removeProperty(key);
    if (stopCurrent === stop) stopCurrent = null;
  };
  stopCurrent = stop;
  root.classList.add("theme-switching");
  if (live) {
    root.classList.add("theme-live-reveal");
    try { applyOnce(); live.play(duration, direction); }
    catch (error) { stop(); throw error; }
    timer.current = setTimeout(stop, duration);
    return;
  }
  if (typeof document.startViewTransition === "function") {
    root.classList.add("theme-wiping");
    try {
      transition = document.startViewTransition(applyOnce);
      // A delayed capture must not hold a click behind an unbounded browser promise.
      timer.current = setTimeout(() => { if (!cancelled) { transition?.skipTransition(); applyOnce(); stop(); } }, 120);
      void transition.ready.then(() => {
        if (cancelled) return;
        clearTimeout(timer.current);
        timer.current = setTimeout(stop, duration);
      }, () => { if (!cancelled) { applyOnce(); stop(); } });
      void transition.finished.then(stop, stop);
      return;
    } catch { root.classList.remove("theme-wiping"); }
  }
  // Older browsers retain the color fade and the same theme/storage behavior.
  applyOnce();
  timer.current = setTimeout(stop, duration + 50);
}
