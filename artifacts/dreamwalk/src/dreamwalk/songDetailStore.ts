import type { DreamSong } from "./dream/types";

let _song: DreamSong | null = null;

export const songDetailStore = {
  set(song: DreamSong) { _song = song; },
  get(): DreamSong | null { return _song; },
  clear() { _song = null; },
};
