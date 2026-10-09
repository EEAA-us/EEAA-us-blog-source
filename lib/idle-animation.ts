// Event-driven canvas effects need frames only while something is being drawn.
// Hidden tabs suspend pending work without starting a second animation loop.
export function createIdleAnimation(draw: () => boolean) {
  let frame: number | null = null;
  let running = false;
  let disposed = false;
  const schedule = () => {
    if (!disposed && running && frame === null && !document.hidden) {
      frame = requestAnimationFrame(tick);
    }
  };
  const tick = () => {
    frame = null;
    if (disposed || document.hidden) return;
    running = draw();
    schedule();
  };
  const visibility = () => {
    if (document.hidden && frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    } else schedule();
  };
  document.addEventListener("visibilitychange", visibility);
  return {
    start() { if (!disposed) { running = true; schedule(); } },
    dispose() {
      disposed = true;
      running = false;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      document.removeEventListener("visibilitychange", visibility);
    },
  };
}
