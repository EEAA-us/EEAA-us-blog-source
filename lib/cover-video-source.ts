export function coverVideoSource(original: string, width: number,
  variants: Record<string, { compact: string; standard: string }>) {
  const copies = variants[original];
  if (!copies || width <= 0 || width > 1920) return original;
  return width <= 1024 ? copies.compact : copies.standard;
}
