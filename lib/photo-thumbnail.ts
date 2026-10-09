import thumbnails from "@/public/photo-thumbnails.json";

export function photoThumbnail(url: string): string {
  return (thumbnails as Record<string, string>)[url] || url;
}
