export interface Chatter {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
}

// Add public short-form posts here if you want sample content on the site.
export const chattersData: Chatter[] = [];
