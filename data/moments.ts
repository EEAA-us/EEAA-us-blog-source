export interface Moment {
  id: string;
  content: string;
  images?: string[];
  mood?: string;
  likes: number;
  created_at: string;
}

// Add moments and images you have permission to publish.
export const momentsData: Moment[] = [];
