import articleCoverSources from "../../../../public/images/article-covers/sources.json";
import animePhotoSources from "../../../../public/images/anime-stills/sources.json";

type SourcePhoto = {
  id: string;
  url: string;
  caption: string;
  sourceUrl?: string;
};
type LocalPhoto = SourcePhoto & { originalUrl: string };
type LocalAlbum = { title: string; photos: LocalPhoto[] };
type CuratedBookmarkSource = {
  id: number;
  name: string;
  description: string;
  sites: {
    name: string;
    url: string;
    description: string;
    icon: string;
    sourceUrl?: string;
  }[];
};
type GameGallerySource = {
  id: string;
  character: string;
  sourceUrl: string;
  localUrl: string;
};

const curatedBookmarkCategories = Object.values(
  import.meta.glob("../../../../data/bookmarks.ts", {
    eager: true,
    import: "curatedBookmarkCategories"
  })
)[0] as CuratedBookmarkSource[];
const gameGallerySources = Object.values(
  import.meta.glob("../../../../data/game-gallery.ts", {
    eager: true,
    import: "gameGallerySources"
  })
)[0] as GameGallerySource[];

const bundledFiles = import.meta.glob(
  [
    "../../../../public/images/{games,article-covers,anime-stills,bookmarks,anime}/*.{webp,png,jpg,jpeg,avif}",
    "../../../../public/images/*.{webp,png,jpg,jpeg,avif}"
  ],
  { eager: true, query: "?url", import: "default" }
) as Record<string, string>;

const mediaUrlByOriginalPath = new Map<string, string>();
for (const [filePath, bundledUrl] of Object.entries(bundledFiles)) {
  const marker = "/public/images/";
  const index = filePath.lastIndexOf(marker);
  if (index >= 0)
    mediaUrlByOriginalPath.set(
      filePath.slice(index + "/public".length),
      bundledUrl
    );
}

export function getBlogMediaUrl(originalPath: string): string {
  return mediaUrlByOriginalPath.get(originalPath) ?? originalPath;
}

function mapSourcePhoto(photo: SourcePhoto): LocalPhoto {
  return { ...photo, originalUrl: photo.url, url: getBlogMediaUrl(photo.url) };
}

const articlePhotos = (articleCoverSources.photos as SourcePhoto[]).map(
  mapSourcePhoto
);
const animePhotos = (animePhotoSources.photos as SourcePhoto[]).map(
  mapSourcePhoto
);
const gamePhotos = gameGallerySources.map(photo =>
  mapSourcePhoto({
    id: photo.id,
    url: photo.localUrl,
    caption: photo.character,
    sourceUrl: photo.sourceUrl
  })
);

export const blogPhotoAlbums: LocalAlbum[] = [
  { title: "文章封面库", photos: articlePhotos },
  { title: "游戏精选", photos: gamePhotos },
  { title: "动漫图片（空相册兜底）", photos: animePhotos }
];

export const curatedBlogBookmarks = curatedBookmarkCategories.map(category => ({
  id: category.id,
  name: category.name,
  description: category.description,
  sites: category.sites.map(site => ({
    name: site.name,
    url: site.url,
    description: site.description,
    icon: site.icon ? getBlogMediaUrl(site.icon) : "",
    sourceUrl: site.sourceUrl
  }))
}));
