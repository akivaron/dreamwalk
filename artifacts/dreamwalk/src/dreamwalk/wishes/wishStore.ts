import type { WishSample } from "./types";

export const wishStore = {
  tiltCamera: false,
  tiltTimer: 0,
  samples: [] as WishSample[],
  count: 0,
  version: 0,
  onWishSelected: null as ((wish: WishSample) => void) | null,
};
