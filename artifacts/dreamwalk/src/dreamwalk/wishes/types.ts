export interface WishSample {
  id: number;
  wishText: string;
  worldId: string;
  createdAt: string;
}

export interface WishesData {
  count: number;
  samples: WishSample[];
}
