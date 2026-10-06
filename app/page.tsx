import HomeClient from "./HomeClient";
import { gameAlbums } from "@/data/game-gallery";
import { localAnimePhotos } from "@/data/photos";
import { articleCoverPhotos } from "@/data/article-covers";
import { readFile } from "node:fs/promises";
import path from "node:path";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchProfileData() {
  if (process.env.NEXT_PUBLIC_CONTENT_MODE === "published") {
    try {
      const file = path.join(process.cwd(), "public", "content", "index.json");
      const index = JSON.parse(await readFile(file, "utf8")) as { posts: unknown[]; albums: Array<{ photo_count: number }> };
      return {
        postCount: index.posts.length,
        photoCount: (index.albums.length ? index.albums.reduce((total, album) => total + album.photo_count, 0) : localAnimePhotos.length) + gameAlbums.reduce((total, album) => total + album.photos.length, 0) + articleCoverPhotos.length,
      };
    } catch {
      return { postCount: null, photoCount: null };
    }
  }
  const read = async (path: string) => {
    try {
      const response = await fetch(`${API}${path}`, { next: { revalidate: 60 } });
      return response.ok ? await response.json() : null;
    } catch {
      return null;
    }
  };
  const [posts, albums] = await Promise.all([read("/api/posts/count?status=published"), read("/api/albums")]);
  return {
    postCount: Number.isInteger(posts?.count) && posts.count >= 0 ? posts.count as number : null,
    photoCount: Array.isArray(albums) && albums.every((album) => Number.isInteger(album?.photo_count) && album.photo_count >= 0)
      ? (albums.length ? albums.reduce((total: number, album: { photo_count: number }) => total + album.photo_count, 0) : localAnimePhotos.length) + gameAlbums.reduce((total, album) => total + album.photos.length, 0) + articleCoverPhotos.length
      : null,
  };
}

export default async function Home() {
  const { postCount, photoCount } = await fetchProfileData();

  return (
    <HomeClient
      postCount={postCount}
      photoCount={photoCount}
    />
  );
}
