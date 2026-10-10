// Only measure on an explicit theme click. Keep the actual media nodes and clocks untouched.
export function themeLiveMediaMasks(document: Document, width: number, height: number) {
  const rects = [...document.querySelectorAll<HTMLElement>("[data-theme-live-media]")].flatMap(element => {
    const bounds = element.getBoundingClientRect();
    const clip = element.closest(".page-cover")?.getBoundingClientRect() ?? bounds;
    const nav = document.querySelector(".site-nav")?.getBoundingClientRect();
    const left = Math.max(0, bounds.left, clip.left);
    const top = Math.max(0, bounds.top, clip.top, nav && nav.bottom > 0 && nav.top <= 0 ? nav.bottom : 0);
    const right = Math.min(width, bounds.right, clip.right);
    const bottom = Math.min(height, bounds.bottom, clip.bottom);
    return right > left && bottom > top ? [{ left, top, width: right - left, height: bottom - top }] : [];
  });
  if (!rects.length || width <= 0 || height <= 0) return {};
  const rectangles = (fill: string) => rects.map(r => `<rect x="${r.left}" y="${r.top}" width="${r.width}" height="${r.height}" fill="${fill}"/>`).join("");
  const image = (content: string) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>`)}")`;
  return {
    // Black within an SVG luminance mask becomes transparent in the resulting image.
    "--theme-static-mask": image(`<defs><mask id="live" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><rect width="100%" height="100%" fill="white"/>${rectangles("black")}</mask></defs><rect width="100%" height="100%" fill="white" mask="url(#live)"/>`),
    "--theme-live-mask": image(rectangles("white")),
  };
}
