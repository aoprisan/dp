export type Privacy = 'public' | 'followers' | 'private';

export interface Photo {
  id: string;
  blob: Blob;
}

export interface Item {
  id: string;
  no: number;
  title: string;
  description: string;
  privacy: Privacy;
  photos: Photo[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Tag {
  id: string;
  name: string;
}
