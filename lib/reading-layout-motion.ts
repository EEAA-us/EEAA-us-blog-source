// Keep the block being read at its current viewport position after reflow.
export function prepareReadingPosition() {
  const blocks = [...document.querySelectorAll<HTMLElement>(".reading-grid article .article-content :is(p,li,h1,h2,h3,pre,table,img)")];
  const candidates = blocks.map(element => ({ element, rect: element.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width && rect.height && rect.bottom > 100 && rect.top < window.innerHeight);
  const anchor = candidates.find(({ rect }) => rect.top <= 160 && rect.bottom >= 160) ?? candidates[0];
  return () => {
    if (!anchor?.element.isConnected) return;
    const delta = anchor.element.getBoundingClientRect().top - anchor.rect.top;
    if (Math.abs(delta) > 1) window.scrollTo({ top: window.scrollY + delta, behavior: "instant" });
  };
}

// Animate the existing panels after React commits a new reading layout.
// Only a user change runs this short FLIP transition; there is no idle animation loop.
export function prepareReadingLayoutMotion() {
  const panels = [...document.querySelectorAll<HTMLElement>(".reading-page > .detail-breadcrumb, .reading-grid > *")];
  const before = panels.map(element => {
    const rect = element.getBoundingClientRect();
    element.getAnimations().forEach(animation => animation.cancel());
    return { element, rect };
  });
  return () => {
    window.dispatchEvent(new Event("reading-layout-change"));
    for (const { element, rect } of before) {
      if (!element.isConnected) continue;
      const next = element.getBoundingClientRect();
      if (!next.width || !next.height) continue;
      if (!rect.width || !rect.height) {
        element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "ease-out" });
        continue;
      }
      const x = rect.left - next.left, y = rect.top - next.top;
      const scaleX = rect.width / next.width, scaleY = rect.height / next.height;
      if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5 && Math.abs(scaleX - 1) < .001 && Math.abs(scaleY - 1) < .001) continue;
      element.animate([
        { transformOrigin: "top left", transform: `translate(${x}px, ${y}px) scale(${scaleX}, ${scaleY})` },
        { transformOrigin: "top left", transform: "none" },
      ], { duration: 300, easing: "cubic-bezier(.2,.7,.2,1)" });
    }
  };
}
