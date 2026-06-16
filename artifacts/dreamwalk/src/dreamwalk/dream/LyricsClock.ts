import type { SyncedLyricLine } from "./types";
import { dreamEvents } from "../audio/audioStore";

export interface LyricsClockState {
  synced: SyncedLyricLine[];
  lastLineIdx: number;
  chorusFadeOut: number;
  bridgeFadeOut: number;
  emotionalFadeOut: number;
}

export function createLyricsClock(synced: SyncedLyricLine[]): LyricsClockState {
  return {
    synced,
    lastLineIdx: -1,
    chorusFadeOut: 0,
    bridgeFadeOut: 0,
    emotionalFadeOut: 0,
  };
}

export function tickLyricsClock(state: LyricsClockState, currentTime: number, delta: number): void {
  if (!state.synced.length) {
    state.chorusFadeOut = Math.max(0, state.chorusFadeOut - delta * 0.4);
    state.bridgeFadeOut = Math.max(0, state.bridgeFadeOut - delta * 0.4);
    state.emotionalFadeOut = Math.max(0, state.emotionalFadeOut - delta * 0.4);
    dreamEvents.isChorus = false;
    dreamEvents.isBridge = false;
    dreamEvents.isEmotionalLine = false;
    dreamEvents.chorusIntensity = state.chorusFadeOut;
    dreamEvents.bridgeIntensity = state.bridgeFadeOut;
    dreamEvents.emotionalIntensity = state.emotionalFadeOut;
    return;
  }

  let currentLine: SyncedLyricLine | null = null;
  for (let i = state.synced.length - 1; i >= 0; i--) {
    if (state.synced[i].time <= currentTime) {
      currentLine = state.synced[i];
      if (i !== state.lastLineIdx) {
        state.lastLineIdx = i;
        dreamEvents.currentLine = state.synced[i].text;
      }
      break;
    }
  }

  if (currentLine) {
    if (currentLine.type === "chorus") {
      state.chorusFadeOut = 1;
    } else {
      state.chorusFadeOut = Math.max(0, state.chorusFadeOut - delta * 0.25);
    }
    if (currentLine.type === "bridge") {
      state.bridgeFadeOut = 1;
    } else {
      state.bridgeFadeOut = Math.max(0, state.bridgeFadeOut - delta * 0.3);
    }
    if (currentLine.isEmotional) {
      state.emotionalFadeOut = 1;
    } else {
      state.emotionalFadeOut = Math.max(0, state.emotionalFadeOut - delta * 0.2);
    }
  } else {
    state.chorusFadeOut = Math.max(0, state.chorusFadeOut - delta * 0.25);
    state.bridgeFadeOut = Math.max(0, state.bridgeFadeOut - delta * 0.3);
    state.emotionalFadeOut = Math.max(0, state.emotionalFadeOut - delta * 0.2);
  }

  dreamEvents.isChorus = state.chorusFadeOut > 0.5;
  dreamEvents.isBridge = state.bridgeFadeOut > 0.5;
  dreamEvents.isEmotionalLine = state.emotionalFadeOut > 0.5;
  dreamEvents.chorusIntensity = state.chorusFadeOut;
  dreamEvents.bridgeIntensity = state.bridgeFadeOut;
  dreamEvents.emotionalIntensity = state.emotionalFadeOut;
}
