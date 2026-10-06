export interface AnimeRecommendation {
  id: string;
  title: string;
  originalTitle: string;
  year: number;
  episodes: string;
  studio: string;
  genres: string[];
  description: string;
  whyWatch: string;
  cover: string;
  officialUrl: string;
  sourceUrl: string;
  rating?: { score: number; source: string; url: string; checkedAt: string };
}

// Add recommendations and licensed cover images for your own site.
export const animeRecommendations: AnimeRecommendation[] = [];
