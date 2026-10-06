const dynamicFiles = import.meta.glob(
  "../../../../public/videos/**/*.{mp4,webm}",
  { eager: true, query: "?url", import: "default" }
) as Record<string, string>;
const dynamicByPath = new Map(
  Object.entries(dynamicFiles).map(([path, url]) => [
    path.slice(path.indexOf("/public/") + 7),
    url
  ])
);
export function adminDynamicMediaUrl(path: string) {
  return dynamicByPath.get(path) ?? path;
}
const posters = import.meta.glob(
  "../../../../public/videos/covers/*.{webp,png,jpg,jpeg}",
  { eager: true, query: "?url", import: "default" }
) as Record<string, string>;
const posterByPath = new Map(
  Object.entries(posters).map(([path, url]) => [
    path.slice(path.indexOf("/public/") + 7),
    url
  ])
);
export function adminMediaPreview(path: string) {
  return posterByPath.get(path) ?? path;
}
