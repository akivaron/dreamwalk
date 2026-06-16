export interface AudioLevels {
  level: number;
  bass: number;
  mid: number;
  treble: number;
  peak: number;
  intensity: number;
  beat: number;
  time: number;
}

export interface StemLevels {
  drums: number;
  bass: number;
  vocals: number;
  instruments: number;
}

export interface DreamEventState {
  isChorus: boolean;
  isBridge: boolean;
  isEmotionalLine: boolean;
  chorusIntensity: number;
  bridgeIntensity: number;
  emotionalIntensity: number;
  currentLine: string;
}

export const audioLevels: AudioLevels = {
  level: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  peak: 0,
  intensity: 0,
  beat: 0,
  time: 0,
};

export const stemLevels: StemLevels = {
  drums: 0,
  bass: 0,
  vocals: 0,
  instruments: 0,
};

export const dreamEvents: DreamEventState = {
  isChorus: false,
  isBridge: false,
  isEmotionalLine: false,
  chorusIntensity: 0,
  bridgeIntensity: 0,
  emotionalIntensity: 0,
  currentLine: "",
};

export function resetAudioLevels(): void {
  audioLevels.level = 0;
  audioLevels.bass = 0;
  audioLevels.mid = 0;
  audioLevels.treble = 0;
  audioLevels.peak = 0;
  audioLevels.intensity = 0;
  audioLevels.beat = 0;
  audioLevels.time = 0;
  stemLevels.drums = 0;
  stemLevels.bass = 0;
  stemLevels.vocals = 0;
  stemLevels.instruments = 0;
  dreamEvents.isChorus = false;
  dreamEvents.isBridge = false;
  dreamEvents.isEmotionalLine = false;
  dreamEvents.chorusIntensity = 0;
  dreamEvents.bridgeIntensity = 0;
  dreamEvents.emotionalIntensity = 0;
  dreamEvents.currentLine = "";
}
