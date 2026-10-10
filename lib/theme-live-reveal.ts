import { themeTransitionDirections, type ThemeTransitionDirection } from "./theme-transition-preferences";

// Animate only the cover's color layers. Never snapshot, clone or seek its media.
export function prepareLiveThemeReveal(document: Document, width: number, height: number) {
  const live = [...document.querySelectorAll<HTMLElement>("[data-theme-live-media]")].some(element => {
    const box = element.getBoundingClientRect();
    return box.right > 0 && box.bottom > 0 && box.left < width && box.top < height && box.width > 0 && box.height > 0;
  });
  if (!live) return null;
  const view = document.defaultView;
  if (!view) return null;
  const surfaces = [...document.querySelectorAll<HTMLElement>(".page-cover-shade, .page-cover-mist")].filter(element => {
    const box = element.getBoundingClientRect();
    return box.right > 0 && box.bottom > 0 && box.left < width && box.top < height;
  });
  const copy = (element: HTMLElement, side: "old" | "new") => {
    const style = view.getComputedStyle(element);
    const layer = document.createElement("div");
    layer.className = `${element.className} theme-live-surface theme-live-surface-${side}`;
    layer.setAttribute("aria-hidden", "true");
    for (const key of ["background-image", "background-color", "opacity", "color", "inset", "transform"])
      layer.style.setProperty(key, style.getPropertyValue(key));
    element.before(layer);
    return layer;
  };
  const entries = surfaces.map(element => ({ element, old: copy(element, "old"), next: null as HTMLElement | null,
    visibility: element.style.getPropertyValue("visibility"), priority: element.style.getPropertyPriority("visibility"),
    box: element.getBoundingClientRect() }));
  const animations: Animation[] = [];
  return {
    play(duration: number, direction: ThemeTransitionDirection) {
      const setting = themeTransitionDirections[direction];
      for (const entry of entries) {
        entry.next = copy(entry.element, "new");
        entry.element.style.setProperty("visibility", "hidden");
        const position = (value: string) => {
          const [x, y] = value.split(" ").map(part => parseFloat(part) / 100);
          return `${-2 * width * x - entry.box.left}px ${-2 * height * y - entry.box.top}px`;
        };
        for (const layer of [entry.old, entry.next]) {
          layer.style.setProperty("--theme-reveal-angle", `${setting.angle}deg`);
          layer.style.maskSize = `${3 * width}px ${3 * height}px`;
          layer.style.maskPosition = position(setting.from);
          const animation = layer.animate([{ maskPosition: position(setting.from) }, { maskPosition: position(setting.to) }],
            { duration, easing: "ease-in-out", fill: "both" });
          void animation.finished.catch(() => {});
          animations.push(animation);
        }
      }
    },
    stop() {
      animations.forEach(animation => animation.cancel());
      for (const entry of entries) {
        entry.old.remove(); entry.next?.remove();
        if (entry.visibility) entry.element.style.setProperty("visibility", entry.visibility, entry.priority);
        else entry.element.style.removeProperty("visibility");
      }
    },
  };
}
