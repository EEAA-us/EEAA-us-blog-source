import type { Album } from "@/components/photos/AlbumCard";

export interface GameGallerySource {
  game: "genshin" | "wuthering" | "zzz";
  id: string;
  character: string;
  sourceUrl: string;
  verifiedTags: string[];
  originalWidth: number;
  originalHeight: number;
  originalBytes: number;
  localUrl: string;
  localWidth: number;
  localHeight: number;
  localBytes: number;
}

// Add only game artwork with permission to redistribute and complete source attribution.
export const gameGallerySources: GameGallerySource[] = [];

const albumDetails: Array<{ game: GameGallerySource["game"]; id: number; title: string }> = [];

export const gameAlbums: Album[] = albumDetails.map(({ game, id, title }) => {
  const photos = gameGallerySources.filter((source) => source.game === game).map((source) => ({
    id: source.id,
    url: source.localUrl,
    caption: source.character,
    orientation: source.localWidth / source.localHeight > 1.1 ? "landscape" as const
      : source.localHeight / source.localWidth > 1.1 ? "portrait" as const : "square" as const,
    sourceUrl: source.sourceUrl,
    width: source.localWidth,
    height: source.localHeight,
  }));
  return { id, title, updatedAt: "2026-10-02T00:00:00", photoCount: photos.length, photos };
});
