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

export function resetAudioLevels(): void {
  audioLevels.level = 0;
  audioLevels.bass = 0;
  audioLevels.mid = 0;
  audioLevels.treble = 0;
  audioLevels.peak = 0;
  audioLevels.intensity = 0;
  audioLevels.beat = 0;
  audioLevels.time = 0;
}
