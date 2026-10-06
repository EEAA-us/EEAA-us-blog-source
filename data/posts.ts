export interface Post {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  tags: string[];
  cover: string;
}

// Public article content is managed separately by the backend.
export const postsData: Post[] = [];
