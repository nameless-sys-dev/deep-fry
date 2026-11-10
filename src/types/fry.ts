export type ScaleMode = 'blocky' | 'muddy';
export type OutputContainer = 'mp4' | 'webm';
export type ControlTab = 'compression' | 'visual' | 'chaos' | 'audio';

export interface FrySettings {
  // Compression & Codec
  scalePercent: number; // 10 - 100
  scaleMode: ScaleMode;
  fps: number; // 0 = original, otherwise 4 - 60
  videoBitrateKbps: number; // 15 - 1500
  quantizerCrunch: number; // 0 - 100 (%)
  keyFrameIntervalSec: number; // 0.5 - 15
  jpegPasses: number; // 0 - 4
  jpegQuality: number; // 1 - 60 (%)
  container: OutputContainer;
  playbackSpeed: number; // 0.5 - 2.5

  // Visual Fry
  sharpen: number; // 0 - 3.0
  contrast: number; // 1.0 - 4.0
  saturation: number; // 1.0 - 5.0
  brightness: number; // 0.6 - 1.8
  highlightBurn: number; // 0 - 1.0
  redTint: number; // 0 - 1.0
  hueShift: number; // -180 - 180
  posterize: number; // 0 (off) or 2 - 24
  vignette: number; // 0 - 1.0
  thermalInvert: boolean;

  // Chaos & Meme Overlays
  blockArtifact: number; // 0 - 1.0
  rgbSplit: number; // 0 - 1.0
  audioShake: number; // 0 - 1.0
  vhsWobble: number; // 0 - 1.0
  noise: number; // 0 - 1.0
  topCaption: string;
  bottomCaption: string;
  captionScale: number; // 0.6 - 1.8
  lensFlare: boolean;
  flareX: number; // 0 - 1
  flareY: number; // 0 - 1
  flareIntensity: number; // 0.2 - 1.5
  emojiChaos: number; // 0 - 1.0

  // Audio Fry
  includeAudio: boolean;
  audioFryEnabled: boolean;
  audioGainDb: number; // 0 - 36
  bassBoostDb: number; // 0 - 30
  distortion: number; // 0 - 1.0
  bitcrushBits: number; // 2 - 16 (16 = clean)
  sampleRateCrunch: number; // 1 - 24
  potatoMic: number; // 0 - 1.0
  echoChaos: number; // 0 - 1.0
  audioBitrateKbps: number; // 8 - 128
  earSafeLimitDb: number; // -12 - -0.5
}

export interface VideoMetadata {
  name: string;
  sizeBytes: number;
  width: number;
  height: number;
  duration: number;
  fps: number;
  hasAudio: boolean;
  codecLabel: string;
}

export interface ExportProgress {
  phase: 'preparing' | 'audio' | 'frames' | 'finalizing';
  progress: number; // 0 - 1
  currentFrame: number;
  totalFrames: number;
  elapsedSec: number;
  realtimeFactor: number;
  engine: 'webcodecs' | 'mediarecorder';
}

export interface ExportResult {
  blob: Blob;
  file: File;
  url: string;
  fileName: string;
  originalSize: number;
  outputSize: number;
  outputWidth: number;
  outputHeight: number;
  outputDuration: number;
  encodeTimeSec: number;
  realtimeFactor: number;
  videoCodec: string;
  audioCodec: string | null;
  engine: 'webcodecs' | 'mediarecorder';
}

export interface FryPreset {
  id: string;
  name: string;
  tagline: string;
  badge: string;
  settings: Partial<FrySettings>;
}

export const DEFAULT_FRY_SETTINGS: FrySettings = {
  scalePercent: 55,
  scaleMode: 'blocky',
  fps: 15,
  videoBitrateKbps: 110,
  quantizerCrunch: 65,
  keyFrameIntervalSec: 4,
  jpegPasses: 1,
  jpegQuality: 12,
  container: 'mp4',
  playbackSpeed: 1.0,

  sharpen: 1.4,
  contrast: 2.1,
  saturation: 2.8,
  brightness: 1.08,
  highlightBurn: 0.35,
  redTint: 0.32,
  hueShift: 0,
  posterize: 0,
  vignette: 0.35,
  thermalInvert: false,

  blockArtifact: 0.45,
  rgbSplit: 0.28,
  audioShake: 0.45,
  vhsWobble: 0.08,
  noise: 0.22,
  topCaption: '',
  bottomCaption: '',
  captionScale: 1.0,
  lensFlare: false,
  flareX: 0.5,
  flareY: 0.38,
  flareIntensity: 0.9,
  emojiChaos: 0,

  includeAudio: true,
  audioFryEnabled: true,
  audioGainDb: 16,
  bassBoostDb: 14,
  distortion: 0.48,
  bitcrushBits: 8,
  sampleRateCrunch: 3,
  potatoMic: 0.15,
  echoChaos: 0,
  audioBitrateKbps: 24,
  earSafeLimitDb: -2.0,
};

export const FRY_PRESETS: FryPreset[] = [
  {
    id: 'mild-crisp',
    name: 'Mild Crisp',
    tagline: 'Light crunchy edges & punchy bass',
    badge: 'LIGHT',
    settings: {
      scalePercent: 75,
      scaleMode: 'muddy',
      fps: 24,
      videoBitrateKbps: 260,
      quantizerCrunch: 30,
      keyFrameIntervalSec: 2,
      jpegPasses: 0,
      jpegQuality: 25,
      sharpen: 0.85,
      contrast: 1.5,
      saturation: 1.85,
      brightness: 1.04,
      highlightBurn: 0.15,
      redTint: 0.12,
      hueShift: 0,
      posterize: 0,
      vignette: 0.15,
      thermalInvert: false,
      blockArtifact: 0.2,
      rgbSplit: 0.12,
      audioShake: 0.2,
      vhsWobble: 0,
      noise: 0.08,
      lensFlare: false,
      emojiChaos: 0,
      audioFryEnabled: true,
      audioGainDb: 8,
      bassBoostDb: 9,
      distortion: 0.2,
      bitcrushBits: 12,
      sampleRateCrunch: 1,
      potatoMic: 0,
      echoChaos: 0,
      audioBitrateKbps: 48,
    },
  },
  {
    id: 'classic-2017',
    name: '2017 Classic',
    tagline: 'Orange burn, crispy halos & JPEG crunch',
    badge: 'MEME',
    settings: {
      ...DEFAULT_FRY_SETTINGS,
      scalePercent: 55,
      scaleMode: 'blocky',
      fps: 15,
      videoBitrateKbps: 110,
      quantizerCrunch: 65,
      keyFrameIntervalSec: 4,
      jpegPasses: 2,
      jpegQuality: 10,
      sharpen: 1.75,
      contrast: 2.35,
      saturation: 3.1,
      brightness: 1.1,
      highlightBurn: 0.45,
      redTint: 0.42,
      hueShift: -6,
      posterize: 10,
      vignette: 0.42,
      thermalInvert: false,
      blockArtifact: 0.52,
      rgbSplit: 0.34,
      audioShake: 0.55,
      vhsWobble: 0.05,
      noise: 0.25,
      lensFlare: true,
      flareIntensity: 0.85,
      emojiChaos: 0.45,
      audioFryEnabled: true,
      audioGainDb: 18,
      bassBoostDb: 16,
      distortion: 0.55,
      bitcrushBits: 7,
      sampleRateCrunch: 3,
      potatoMic: 0.12,
      echoChaos: 0,
      audioBitrateKbps: 20,
    },
  },
  {
    id: 'hypercam-2009',
    name: '2009 Potato',
    tagline: '144p muddy reupload + headset mic',
    badge: 'POTATO',
    settings: {
      scalePercent: 25,
      scaleMode: 'muddy',
      fps: 10,
      videoBitrateKbps: 38,
      quantizerCrunch: 85,
      keyFrameIntervalSec: 8,
      jpegPasses: 1,
      jpegQuality: 8,
      sharpen: 0.9,
      contrast: 1.65,
      saturation: 1.45,
      brightness: 0.96,
      highlightBurn: 0.12,
      redTint: 0.05,
      hueShift: 0,
      posterize: 0,
      vignette: 0.12,
      thermalInvert: false,
      blockArtifact: 0.82,
      rgbSplit: 0.1,
      audioShake: 0.15,
      vhsWobble: 0.04,
      noise: 0.2,
      lensFlare: false,
      emojiChaos: 0,
      audioFryEnabled: true,
      audioGainDb: 14,
      bassBoostDb: 4,
      distortion: 0.42,
      bitcrushBits: 6,
      sampleRateCrunch: 8,
      potatoMic: 0.88,
      echoChaos: 0.22,
      audioBitrateKbps: 10,
    },
  },
  {
    id: 'nuked-abyssal',
    name: 'Nuked',
    tagline: 'Radioactive crimson & bassquake distortion',
    badge: 'MAX',
    settings: {
      scalePercent: 40,
      scaleMode: 'blocky',
      fps: 12,
      videoBitrateKbps: 45,
      quantizerCrunch: 95,
      keyFrameIntervalSec: 10,
      jpegPasses: 3,
      jpegQuality: 4,
      sharpen: 2.65,
      contrast: 3.4,
      saturation: 4.5,
      brightness: 1.25,
      highlightBurn: 0.85,
      redTint: 0.82,
      hueShift: -12,
      posterize: 6,
      vignette: 0.72,
      thermalInvert: false,
      blockArtifact: 0.85,
      rgbSplit: 0.78,
      audioShake: 0.92,
      vhsWobble: 0.25,
      noise: 0.55,
      lensFlare: true,
      flareIntensity: 1.3,
      emojiChaos: 0.75,
      audioFryEnabled: true,
      audioGainDb: 30,
      bassBoostDb: 26,
      distortion: 0.92,
      bitcrushBits: 4,
      sampleRateCrunch: 6,
      potatoMic: 0.25,
      echoChaos: 0.35,
      audioBitrateKbps: 12,
    },
  },
  {
    id: 'vhs-cursed',
    name: 'VHS Cursed',
    tagline: 'Haunted tape wobble, scanlines & garble',
    badge: 'VHS',
    settings: {
      scalePercent: 48,
      scaleMode: 'muddy',
      fps: 18,
      videoBitrateKbps: 85,
      quantizerCrunch: 70,
      keyFrameIntervalSec: 6,
      jpegPasses: 1,
      jpegQuality: 14,
      sharpen: 1.2,
      contrast: 2.0,
      saturation: 2.2,
      brightness: 0.92,
      highlightBurn: 0.28,
      redTint: 0.18,
      hueShift: 18,
      posterize: 12,
      vignette: 0.65,
      thermalInvert: false,
      blockArtifact: 0.35,
      rgbSplit: 0.68,
      audioShake: 0.35,
      vhsWobble: 0.88,
      noise: 0.5,
      lensFlare: false,
      emojiChaos: 0,
      audioFryEnabled: true,
      audioGainDb: 15,
      bassBoostDb: 12,
      distortion: 0.58,
      bitcrushBits: 7,
      sampleRateCrunch: 5,
      potatoMic: 0.55,
      echoChaos: 0.65,
      audioBitrateKbps: 14,
    },
  },
];

export function randomizeFrySettings(current: FrySettings): FrySettings {
  const rand = (min: number, max: number) => min + Math.random() * (max - min);
  const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

  const funnyTops = ['', 'WHEN THE', 'BRO REALLY', 'POV:', 'NOBODY:', 'ME AT 3AM', 'BOTTOM TEXT'];
  const funnyBottoms = ['', 'BOTTOM TEXT', 'FR FR NO CAP', 'LIVE REACTION', 'REAL.', 'SEND HELP', ''];

  return {
    ...current,
    scalePercent: randInt(22, 75),
    scaleMode: Math.random() > 0.45 ? 'blocky' : 'muddy',
    fps: [8, 10, 12, 15, 20, 24][randInt(0, 5)],
    videoBitrateKbps: randInt(25, 220),
    quantizerCrunch: randInt(35, 98),
    keyFrameIntervalSec: randInt(2, 12),
    jpegPasses: randInt(0, 3),
    jpegQuality: randInt(3, 22),
    playbackSpeed: Number(([0.75, 1, 1, 1, 1.25, 1.5, 1.85][randInt(0, 6)]).toFixed(2)),

    sharpen: Number(rand(0.6, 2.7).toFixed(2)),
    contrast: Number(rand(1.4, 3.4).toFixed(2)),
    saturation: Number(rand(1.6, 4.6).toFixed(2)),
    brightness: Number(rand(0.88, 1.28).toFixed(2)),
    highlightBurn: Number(rand(0.1, 0.85).toFixed(2)),
    redTint: Number(rand(0.05, 0.85).toFixed(2)),
    hueShift: Math.random() > 0.65 ? randInt(-90, 90) : randInt(-14, 14),
    posterize: Math.random() > 0.4 ? randInt(4, 14) : 0,
    vignette: Number(rand(0.15, 0.75).toFixed(2)),
    thermalInvert: Math.random() > 0.85,

    blockArtifact: Number(rand(0.25, 0.92).toFixed(2)),
    rgbSplit: Number(rand(0.12, 0.85).toFixed(2)),
    audioShake: Number(rand(0.15, 0.95).toFixed(2)),
    vhsWobble: Number((Math.random() > 0.5 ? rand(0.2, 0.9) : rand(0, 0.12)).toFixed(2)),
    noise: Number(rand(0.1, 0.6).toFixed(2)),
    topCaption: current.topCaption || (Math.random() > 0.6 ? funnyTops[randInt(0, funnyTops.length - 1)] : ''),
    bottomCaption: current.bottomCaption || (Math.random() > 0.6 ? funnyBottoms[randInt(0, funnyBottoms.length - 1)] : ''),
    lensFlare: Math.random() > 0.55,
    flareX: Number(rand(0.25, 0.75).toFixed(2)),
    flareY: Number(rand(0.2, 0.55).toFixed(2)),
    flareIntensity: Number(rand(0.6, 1.35).toFixed(2)),
    emojiChaos: Math.random() > 0.55 ? Number(rand(0.25, 0.85).toFixed(2)) : 0,

    audioFryEnabled: true,
    audioGainDb: randInt(10, 32),
    bassBoostDb: randInt(6, 28),
    distortion: Number(rand(0.25, 0.95).toFixed(2)),
    bitcrushBits: randInt(3, 10),
    sampleRateCrunch: randInt(1, 10),
    potatoMic: Number((Math.random() > 0.5 ? rand(0.2, 0.85) : 0).toFixed(2)),
    echoChaos: Number((Math.random() > 0.65 ? rand(0.2, 0.7) : 0).toFixed(2)),
    audioBitrateKbps: [8, 12, 16, 24, 32, 48][randInt(0, 5)],
  };
}

export function computeTargetDimensions(
  srcW: number,
  srcH: number,
  scalePercent: number
): { width: number; height: number } {
  const ratio = Math.max(0.1, Math.min(1, scalePercent / 100));
  const rawW = Math.max(32, Math.round(srcW * ratio));
  const rawH = Math.max(32, Math.round(srcH * ratio));
  // H.264/HEVC require even dimensions
  const width = Math.max(32, Math.round(rawW / 2) * 2);
  const height = Math.max(32, Math.round(rawH / 2) * 2);
  return { width, height };
}

export function estimateOutputSizeBytes(
  durationSec: number,
  settings: FrySettings
): number {
  const effectiveDuration = Math.max(0.5, durationSec / settings.playbackSpeed);
  const videoBytes = (settings.videoBitrateKbps * 1000 * effectiveDuration) / 8;
  const audioBytes =
    settings.includeAudio
      ? (settings.audioBitrateKbps * 1000 * effectiveDuration) / 8
      : 0;
  // Quantizer crunch often forces actual output even lower or slightly variable
  const qFactor = settings.quantizerCrunch > 60 ? 0.82 : 1.0;
  return Math.max(8192, Math.round((videoBytes + audioBytes) * qFactor));
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatTimecode(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00.0';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const tenths = Math.floor((sec % 1) * 10);
  return `${m}:${s.toString().padStart(2, '0')}.${tenths}`;
}
