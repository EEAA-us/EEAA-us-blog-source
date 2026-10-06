import animeStills from "@/public/images/anime-stills/sources.json";

interface AnimeStillSource {
  id: string;
  url: string;
  caption: string;
  width: number;
  height: number;
  sourceUrl?: string;
}

export interface Photo {
  id: string;
  url: string;
  caption: string;
  orientation: "landscape" | "portrait" | "square";
  sourceUrl?: string;
  width?: number;
  height?: number;
}

export interface PhotoDay {
  date: string;
  label: string;
  photos: Photo[];
}

const stillSources = animeStills as { photos: AnimeStillSource[] };
export const localAnimePhotos: Photo[] = stillSources.photos.map((photo) => ({
  id: photo.id,
  url: photo.url,
  caption: photo.caption,
  orientation: photo.width > photo.height ? "landscape" : photo.width === photo.height ? "square" : "portrait",
  sourceUrl: photo.sourceUrl,
  width: photo.width,
  height: photo.height,
}));

// Add photo days and locally hosted images only after checking distribution rights.
export const photoDays: PhotoDay[] = [];
