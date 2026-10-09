// One short viewport reveal per explicit click; never a continuous canvas loop.
let stopCurrent: (() => void) | null = null;

export function stopThemeTransition() {
  stopCurrent?.();
  stopCurrent = null;
}

export function runThemeTransition(apply: () => void, reducedMotion: boolean) {
  stopThemeTransition();
  if (reducedMotion) { apply(); return; }
  const root = document.documentElement;
  let cancelled = false;
  const timer: { current?: ReturnType<typeof setTimeout> } = {};
  let transition: ViewTransition | undefined;
  const stop = () => {
    if (cancelled) return;
    cancelled = true;
    clearTimeout(timer.current);
    transition?.skipTransition();
    root.classList.remove("theme-switching", "theme-wiping");
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
  timer.current = setTimeout(stop, 700);
}
