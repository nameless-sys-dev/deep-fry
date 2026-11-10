import React from 'react';
import {
  Flame,
  Gauge,
  Loader2,
  Palette,
  Sparkles,
  Square,
  Volume2,
  Zap,
} from 'lucide-react';
import {
  computeTargetDimensions,
  ControlTab,
  DEFAULT_FRY_SETTINGS,
  estimateOutputSizeBytes,
  ExportProgress,
  formatBytes,
  FrySettings,
  VideoMetadata,
} from '../types/fry';
import { FrySlider } from './FrySlider';

interface ControlRackProps {
  activeTab: ControlTab;
  onTabChange: (tab: ControlTab) => void;
  settings: FrySettings;
  onChange: <K extends keyof FrySettings>(key: K, value: FrySettings[K]) => void;
  onBatchChange: (patch: Partial<FrySettings>) => void;
  metadata: VideoMetadata | null;
  trimDuration: number;
  hasVideo: boolean;
  isExporting: boolean;
  exportProgress: ExportProgress | null;
  onExport: () => void;
  onCancelExport: () => void;
}

const TABS: { id: ControlTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'compression', label: 'Compress', icon: Gauge },
  { id: 'visual', label: 'Visual', icon: Palette },
  { id: 'chaos', label: 'Chaos', icon: Sparkles },
  { id: 'audio', label: 'Audio', icon: Volume2 },
];

export const ControlRack: React.FC<ControlRackProps> = ({
  activeTab,
  onTabChange,
  settings,
  onChange,
  onBatchChange,
  metadata,
  trimDuration,
  hasVideo,
  isExporting,
  exportProgress,
  onExport,
  onCancelExport,
}) => {
  const targetDims = metadata
    ? computeTargetDimensions(metadata.width, metadata.height, settings.scalePercent)
    : null;
  const estBytes = metadata ? estimateOutputSizeBytes(trimDuration, settings) : 0;

  return (
    <aside className="flex flex-col rounded-xl border border-[#24242e] bg-[#121217] overflow-hidden h-full max-h-[780px] lg:max-h-[calc(100vh-88px)]">
      {/* Tab Header */}
      <div className="grid grid-cols-4 border-b border-[#22222c] bg-[#0e0e12] p-1 gap-1 shrink-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                active
                  ? 'bg-[#1f1f28] text-[#ff8a3d] border border-[#323242] shadow-sm'
                  : 'text-[#8e8a81] hover:text-[#e5e0d6] border border-transparent'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Scrollable Controls */}
      <div className="flex-1 overflow-y-auto fry-scroll p-4 space-y-5">
        {activeTab === 'compression' && (
          <>
            {/* Resolution & Scaling */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-mono uppercase tracking-wider text-[#8e8a81]">
                  Resolution & Scaling
                </h3>
                <div className="flex gap-1">
                  {[
                    { label: '144p', pct: metadata ? Math.max(10, Math.min(100, Math.round((144 / metadata.height) * 100))) : 25 },
                    { label: '240p', pct: metadata ? Math.max(10, Math.min(100, Math.round((240 / metadata.height) * 100))) : 40 },
                    { label: '360p', pct: metadata ? Math.max(10, Math.min(100, Math.round((360 / metadata.height) * 100))) : 55 },
                    { label: '100%', pct: 100 },
                  ].map((pill) => (
                    <button
                      key={pill.label}
                      type="button"
                      onClick={() => onChange('scalePercent', pill.pct)}
                      className={`font-mono text-[10px] px-1.5 py-0.5 rounded border cursor-pointer transition-colors ${
                        settings.scalePercent === pill.pct
                          ? 'bg-[#ff6b1a]/20 border-[#ff6b1a] text-[#ff9500]'
                          : 'bg-[#191920] border-[#292934] text-[#9c978d] hover:text-white'
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>
              </div>

              <FrySlider
                label="Resolution Scale"
                value={settings.scalePercent}
                min={10}
                max={100}
                step={1}
                formatValue={(v) =>
                  targetDims ? `${v}% (${targetDims.width}×${targetDims.height})` : `${v}%`
                }
                defaultValue={DEFAULT_FRY_SETTINGS.scalePercent}
                onChange={(v) => onChange('scalePercent', v)}
              />

              <div className="grid grid-cols-2 gap-2">
                {(['blocky', 'muddy'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onChange('scaleMode', mode)}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                      settings.scaleMode === mode
                        ? 'bg-[#ff6b1a]/15 border-[#ff6b1a] text-white'
                        : 'bg-[#17171d] border-[#272732] text-[#9b978e] hover:text-white'
                    }`}
                  >
                    {mode === 'blocky' ? 'Blocky (Nearest)' : 'Muddy (Bilinear)'}
                  </button>
                ))}
              </div>
            </div>

            <hr className="border-[#20202a]" />

            {/* Frame Rate & Speed */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-mono uppercase tracking-wider text-[#8e8a81]">
                  Framerate & Speed
                </h3>
                <div className="flex gap-1">
                  {[
                    { label: '5fps', v: 5 },
                    { label: '10fps', v: 10 },
                    { label: '15fps', v: 15 },
                    { label: '24fps', v: 24 },
                    { label: 'Orig', v: 0 },
                  ].map((f) => (
                    <button
                      key={f.label}
                      type="button"
                      onClick={() => onChange('fps', f.v)}
                      className={`font-mono text-[10px] px-1.5 py-0.5 rounded border cursor-pointer ${
                        settings.fps === f.v
                          ? 'bg-[#ff6b1a]/20 border-[#ff6b1a] text-[#ff9500]'
                          : 'bg-[#191920] border-[#292934] text-[#9c978d] hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <FrySlider
                label="Output FPS"
                value={settings.fps}
                min={0}
                max={60}
                step={1}
                formatValue={(v) => (v === 0 ? 'Original' : `${v} fps`)}
                defaultValue={DEFAULT_FRY_SETTINGS.fps}
                onChange={(v) => onChange('fps', v)}
              />

              <FrySlider
                label="Playback Speed"
                value={settings.playbackSpeed}
                min={0.5}
                max={2.5}
                step={0.05}
                formatValue={(v) => `${v.toFixed(2)}x`}
                defaultValue={DEFAULT_FRY_SETTINGS.playbackSpeed}
                accent="lime"
                onChange={(v) => onChange('playbackSpeed', v)}
              />
            </div>

            <hr className="border-[#20202a]" />

            {/* Codec Bitrate & Quantizer Crunch */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-mono uppercase tracking-wider text-[#8e8a81]">
                  Codec Over-Compression
                </h3>
                <div className="flex gap-1">
                  {[20, 55, 110, 350].map((br) => (
                    <button
                      key={br}
                      type="button"
                      onClick={() => onChange('videoBitrateKbps', br)}
                      className={`font-mono text-[10px] px-1.5 py-0.5 rounded border cursor-pointer ${
                        settings.videoBitrateKbps === br
                          ? 'bg-[#ff2e4c]/20 border-[#ff2e4c] text-[#ff6b81]'
                          : 'bg-[#191920] border-[#292934] text-[#9c978d] hover:text-white'
                      }`}
                    >
                      {br}k
                    </button>
                  ))}
                </div>
              </div>

              <FrySlider
                label="Video Bitrate"
                value={settings.videoBitrateKbps}
                min={15}
                max={1500}
                step={5}
                unit=" kbps"
                defaultValue={DEFAULT_FRY_SETTINGS.videoBitrateKbps}
                accent="crimson"
                onChange={(v) => onChange('videoBitrateKbps', v)}
              />

              <FrySlider
                label="Quantizer Crunch (QP)"
                hint="forces macroblocks"
                value={settings.quantizerCrunch}
                min={0}
                max={100}
                step={5}
                unit="%"
                defaultValue={DEFAULT_FRY_SETTINGS.quantizerCrunch}
                accent="crimson"
                onChange={(v) => onChange('quantizerCrunch', v)}
              />

              <FrySlider
                label="Keyframe Interval (GOP)"
                hint="P-frame smear"
                value={settings.keyFrameIntervalSec}
                min={0.5}
                max={15}
                step={0.5}
                unit="s"
                defaultValue={DEFAULT_FRY_SETTINGS.keyFrameIntervalSec}
                onChange={(v) => onChange('keyFrameIntervalSec', v)}
              />
            </div>

            <hr className="border-[#20202a]" />

            {/* Multi-Pass JPEG Re-Fry */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-mono uppercase tracking-wider text-[#8e8a81]">
                  Real Multi-Pass JPEG Re-Fry
                </h3>
                <span className="font-mono text-[10px] text-[#ff9500]">
                  {settings.jpegPasses > 0 ? 'Bakes 8×8 DCT' : 'Off (GPU Only)'}
                </span>
              </div>

              <FrySlider
                label="JPEG Re-Fry Passes"
                value={settings.jpegPasses}
                min={0}
                max={4}
                step={1}
                formatValue={(v) => (v === 0 ? '0 (Off)' : `${v} pass${v > 1 ? 'es' : ''}`)}
                defaultValue={DEFAULT_FRY_SETTINGS.jpegPasses}
                onChange={(v) => onChange('jpegPasses', v)}
              />

              <FrySlider
                label="JPEG Quality"
                value={settings.jpegQuality}
                min={1}
                max={60}
                step={1}
                unit="%"
                disabled={settings.jpegPasses === 0}
                defaultValue={DEFAULT_FRY_SETTINGS.jpegQuality}
                accent="crimson"
                onChange={(v) => onChange('jpegQuality', v)}
              />

              {/* Container Selector */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {(['mp4', 'webm'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => onChange('container', fmt)}
                    className={`py-2 px-3 rounded-lg text-xs font-mono font-semibold border transition-all cursor-pointer uppercase ${
                      settings.container === fmt
                        ? 'bg-[#a3e635]/15 border-[#a3e635] text-[#ecfccb]'
                        : 'bg-[#17171d] border-[#272732] text-[#9b978e] hover:text-white'
                    }`}
                  >
                    .{fmt} {fmt === 'mp4' ? '(H.264)' : '(VP8/VP9)'}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'visual' && (
          <>
            <div className="space-y-3">
              <h3 className="text-[11px] font-mono uppercase tracking-wider text-[#8e8a81]">
                Crispy Halos & Contrast
              </h3>

              <FrySlider
                label="Crisp Sharpen Halos"
                value={settings.sharpen}
                min={0}
                max={3}
                step={0.05}
                formatValue={(v) => `${Math.round(v * 100)}%`}
                defaultValue={DEFAULT_FRY_SETTINGS.sharpen}
                onChange={(v) => onChange('sharpen', v)}
              />

              <FrySlider
                label="Contrast Smash"
                value={settings.contrast}
                min={1}
                max={4}
                step={0.05}
                formatValue={(v) => `${Math.round(v * 100)}%`}
                defaultValue={DEFAULT_FRY_SETTINGS.contrast}
                onChange={(v) => onChange('contrast', v)}
              />

              <FrySlider
                label="Saturation Overdrive"
                value={settings.saturation}
                min={1}
                max={5}
                step={0.05}
                formatValue={(v) => `${Math.round(v * 100)}%`}
                defaultValue={DEFAULT_FRY_SETTINGS.saturation}
                onChange={(v) => onChange('saturation', v)}
              />

              <FrySlider
                label="Brightness"
                value={settings.brightness}
                min={0.6}
                max={1.8}
                step={0.02}
                formatValue={(v) => `${Math.round(v * 100)}%`}
                defaultValue={DEFAULT_FRY_SETTINGS.brightness}
                onChange={(v) => onChange('brightness', v)}
              />

              <FrySlider
                label="Highlight Burn"
                value={settings.highlightBurn}
                min={0}
                max={1}
                step={0.02}
                formatValue={(v) => `${Math.round(v * 100)}%`}
                defaultValue={DEFAULT_FRY_SETTINGS.highlightBurn}
                accent="crimson"
                onChange={(v) => onChange('highlightBurn', v)}
              />
            </div>

            <hr className="border-[#20202a]" />

            <div className="space-y-3">
              <h3 className="text-[11px] font-mono uppercase tracking-wider text-[#8e8a81]">
                Color Burn & Bit Depth
              </h3>

              <FrySlider
                label="Nuclear Red/Orange Tint"
                value={settings.redTint}
                min={0}
                max={1}
                step={0.02}
                formatValue={(v) => `${Math.round(v * 100)}%`}
                defaultValue={DEFAULT_FRY_SETTINGS.redTint}
                accent="crimson"
                onChange={(v) => onChange('redTint', v)}
              />

              <FrySlider
                label="Hue Shift"
                value={settings.hueShift}
                min={-180}
                max={180}
                step={1}
                unit="°"
                defaultValue={DEFAULT_FRY_SETTINGS.hueShift}
                onChange={(v) => onChange('hueShift', v)}
              />

              <FrySlider
                label="Posterize Color Levels"
                value={settings.posterize}
                min={0}
                max={24}
                step={1}
                formatValue={(v) => (v < 2 ? 'Off' : `${v} levels`)}
                defaultValue={DEFAULT_FRY_SETTINGS.posterize}
                onChange={(v) => onChange('posterize', v < 2 ? 0 : v)}
              />

              <FrySlider
                label="Charred Vignette"
                value={settings.vignette}
                min={0}
                max={1}
                step={0.02}
                formatValue={(v) => `${Math.round(v * 100)}%`}
                defaultValue={DEFAULT_FRY_SETTINGS.vignette}
                onChange={(v) => onChange('vignette', v)}
              />

              <label className="flex items-center justify-between p-2.5 rounded-lg bg-[#181820] border border-[#282834] cursor-pointer">
                <div>
                  <span className="text-xs font-semibold text-[#f5f2eb] block">
                    Cursed Thermal / Invert
                  </span>
                  <span className="text-[11px] text-[#8d8880]">
                    Inverts RGB channels for haunted negative look
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.thermalInvert}
                  onChange={(e) => onChange('thermalInvert', e.target.checked)}
                  className="h-4 w-4 accent-[#ff6b1a] cursor-pointer"
                />
              </label>
            </div>
          </>
        )}

        {activeTab === 'chaos' && (
          <>
            <div className="space-y-3">
              <h3 className="text-[11px] font-mono uppercase tracking-wider text-[#8e8a81]">
                Artifacting & Glitch Motion
              </h3>

              <FrySlider
                label="Audio-Reactive Screen Shake"
                value={settings.audioShake}
                min={0}
                max={1}
                step={0.02}
                formatValue={(v) => `${Math.round(v * 100)}%`}
                defaultValue={DEFAULT_FRY_SETTINGS.audioShake}
                accent="crimson"
                onChange={(v) => onChange('audioShake', v)}
              />

              <FrySlider
                label="Macroblock & Chroma Bleed"
                value={settings.blockArtifact}
                min={0}
                max={1}
                step={0.02}
                formatValue={(v) => `${Math.round(v * 100)}%`}
                defaultValue={DEFAULT_FRY_SETTINGS.blockArtifact}
                onChange={(v) => onChange('blockArtifact', v)}
              />

              <FrySlider
                label="RGB Chromatic Split"
                value={settings.rgbSplit}
                min={0}
                max={1}
                step={0.02}
                formatValue={(v) => `${Math.round(v * 100)}%`}
                defaultValue={DEFAULT_FRY_SETTINGS.rgbSplit}
                onChange={(v) => onChange('rgbSplit', v)}
              />

              <FrySlider
                label="VHS Wobble & Scanlines"
                value={settings.vhsWobble}
                min={0}
                max={1}
                step={0.02}
                formatValue={(v) => `${Math.round(v * 100)}%`}
                defaultValue={DEFAULT_FRY_SETTINGS.vhsWobble}
                onChange={(v) => onChange('vhsWobble', v)}
              />

              <FrySlider
                label="Digital Sensor Noise"
                value={settings.noise}
                min={0}
                max={1}
                step={0.02}
                formatValue={(v) => `${Math.round(v * 100)}%`}
                defaultValue={DEFAULT_FRY_SETTINGS.noise}
                onChange={(v) => onChange('noise', v)}
              />
            </div>

            <hr className="border-[#20202a]" />

            {/* Meme Captions */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-mono uppercase tracking-wider text-[#8e8a81]">
                  Impact Meme Captions
                </h3>
                {(settings.topCaption || settings.bottomCaption) && (
                  <button
                    type="button"
                    onClick={() => onBatchChange({ topCaption: '', bottomCaption: '' })}
                    className="text-[10px] font-mono text-[#ff6b1a] hover:underline cursor-pointer"
                  >
                    Clear Text
                  </button>
                )}
              </div>

              <input
                type="text"
                placeholder="TOP TEXT (gets deep-fried too)"
                value={settings.topCaption}
                onChange={(e) => onChange('topCaption', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0d0d11] border border-[#2a2a36] focus:border-[#ff6b1a] focus:outline-none text-xs text-white placeholder-[#625f58] uppercase font-semibold"
              />
              <input
                type="text"
                placeholder="BOTTOM TEXT"
                value={settings.bottomCaption}
                onChange={(e) => onChange('bottomCaption', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0d0d11] border border-[#2a2a36] focus:border-[#ff6b1a] focus:outline-none text-xs text-white placeholder-[#625f58] uppercase font-semibold"
              />
              <FrySlider
                label="Caption Size"
                value={settings.captionScale}
                min={0.6}
                max={1.8}
                step={0.05}
                formatValue={(v) => `${Math.round(v * 100)}%`}
                defaultValue={DEFAULT_FRY_SETTINGS.captionScale}
                onChange={(v) => onChange('captionScale', v)}
              />
            </div>

            <hr className="border-[#20202a]" />

            {/* Lens Flares & Emoji Chaos */}
            <div className="space-y-3">
              <label className="flex items-center justify-between p-2.5 rounded-lg bg-[#181820] border border-[#282834] cursor-pointer">
                <div>
                  <span className="text-xs font-semibold text-[#f5f2eb] block">
                    Laser Lens Flare Burst
                  </span>
                  <span className="text-[11px] text-[#8d8880]">
                    Pulses with bass · Drag on video to position
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.lensFlare}
                  onChange={(e) => onChange('lensFlare', e.target.checked)}
                  className="h-4 w-4 accent-[#ff6b1a] cursor-pointer"
                />
              </label>

              {settings.lensFlare && (
                <FrySlider
                  label="Flare Intensity"
                  value={settings.flareIntensity}
                  min={0.2}
                  max={1.5}
                  step={0.05}
                  formatValue={(v) => `${Math.round(v * 100)}%`}
                  defaultValue={DEFAULT_FRY_SETTINGS.flareIntensity}
                  accent="crimson"
                  onChange={(v) => onChange('flareIntensity', v)}
                />
              )}

              <FrySlider
                label="Bouncing Emoji Chaos 😂💯🔥"
                value={settings.emojiChaos}
                min={0}
                max={1}
                step={0.05}
                formatValue={(v) => (v <= 0.02 ? 'Off' : `${Math.round(v * 100)}%`)}
                defaultValue={DEFAULT_FRY_SETTINGS.emojiChaos}
                onChange={(v) => onChange('emojiChaos', v)}
              />
            </div>
          </>
        )}

        {activeTab === 'audio' && (
          <>
            <div className="space-y-2.5">
              <label className="flex items-center justify-between p-2.5 rounded-lg bg-[#181820] border border-[#282834] cursor-pointer">
                <div>
                  <span className="text-xs font-semibold text-[#f5f2eb] block">
                    Include Audio Track
                  </span>
                  <span className="text-[11px] text-[#8d8880]">
                    Turn off to export a silent video
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.includeAudio}
                  onChange={(e) => onChange('includeAudio', e.target.checked)}
                  className="h-4 w-4 accent-[#ff6b1a] cursor-pointer"
                />
              </label>

              <label
                className={`flex items-center justify-between p-2.5 rounded-lg bg-[#181820] border border-[#282834] cursor-pointer ${
                  !settings.includeAudio ? 'opacity-40 pointer-events-none' : ''
                }`}
              >
                <div>
                  <span className="text-xs font-semibold text-[#f5f2eb] block">
                    Deep-Fry Audio FX
                  </span>
                  <span className="text-[11px] text-[#8d8880]">
                    Uncheck to keep original clean audio
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.audioFryEnabled}
                  disabled={!settings.includeAudio}
                  onChange={(e) => onChange('audioFryEnabled', e.target.checked)}
                  className="h-4 w-4 accent-[#ff6b1a] cursor-pointer"
                />
              </label>
            </div>

            <div
              className={`space-y-3 ${
                !settings.includeAudio || !settings.audioFryEnabled
                  ? 'opacity-40 pointer-events-none'
                  : ''
              }`}
            >
              <h3 className="text-[11px] font-mono uppercase tracking-wider text-[#8e8a81]">
                Overdrive & Bass Crunch
              </h3>

              <FrySlider
                label="Pre-Gain Overdrive"
                value={settings.audioGainDb}
                min={0}
                max={36}
                step={1}
                formatValue={(v) => `+${v} dB`}
                defaultValue={DEFAULT_FRY_SETTINGS.audioGainDb}
                accent="crimson"
                onChange={(v) => onChange('audioGainDb', v)}
              />

              <FrySlider
                label="Sub Bass Boost (95Hz)"
                value={settings.bassBoostDb}
                min={0}
                max={30}
                step={1}
                formatValue={(v) => `+${v} dB`}
                defaultValue={DEFAULT_FRY_SETTINGS.bassBoostDb}
                accent="crimson"
                onChange={(v) => onChange('bassBoostDb', v)}
              />

              <FrySlider
                label="Hard-Clip Distortion"
                value={settings.distortion}
                min={0}
                max={1}
                step={0.02}
                formatValue={(v) => `${Math.round(v * 100)}%`}
                defaultValue={DEFAULT_FRY_SETTINGS.distortion}
                accent="crimson"
                onChange={(v) => onChange('distortion', v)}
              />

              <hr className="border-[#20202a]" />

              <h3 className="text-[11px] font-mono uppercase tracking-wider text-[#8e8a81]">
                Lo-Fi Crunch & Codec Garble
              </h3>

              <FrySlider
                label="Bitcrush Depth"
                value={settings.bitcrushBits}
                min={2}
                max={16}
                step={1}
                formatValue={(v) => (v >= 16 ? '16-bit (Off)' : `${v}-bit`)}
                defaultValue={DEFAULT_FRY_SETTINGS.bitcrushBits}
                onChange={(v) => onChange('bitcrushBits', v)}
              />

              <FrySlider
                label="Sample-Rate Downsample"
                value={settings.sampleRateCrunch}
                min={1}
                max={24}
                step={1}
                formatValue={(v) => (v <= 1 ? '1x (Off)' : `${v}x hold`)}
                defaultValue={DEFAULT_FRY_SETTINGS.sampleRateCrunch}
                onChange={(v) => onChange('sampleRateCrunch', v)}
              />

              <FrySlider
                label="Potato Headset Mic EQ"
                value={settings.potatoMic}
                min={0}
                max={1}
                step={0.02}
                formatValue={(v) => `${Math.round(v * 100)}%`}
                defaultValue={DEFAULT_FRY_SETTINGS.potatoMic}
                onChange={(v) => onChange('potatoMic', v)}
              />

              <FrySlider
                label="Tin-Can Slapback Echo"
                value={settings.echoChaos}
                min={0}
                max={1}
                step={0.02}
                formatValue={(v) => `${Math.round(v * 100)}%`}
                defaultValue={DEFAULT_FRY_SETTINGS.echoChaos}
                onChange={(v) => onChange('echoChaos', v)}
              />

              <FrySlider
                label="Output Audio Bitrate"
                value={settings.audioBitrateKbps}
                min={8}
                max={128}
                step={4}
                unit=" kbps"
                defaultValue={DEFAULT_FRY_SETTINGS.audioBitrateKbps}
                onChange={(v) => onChange('audioBitrateKbps', v)}
              />

              <FrySlider
                label="Ear-Safe Output Ceiling"
                hint="brickwall limiter"
                value={settings.earSafeLimitDb}
                min={-12}
                max={-0.5}
                step={0.5}
                formatValue={(v) => `${v.toFixed(1)} dBFS`}
                defaultValue={DEFAULT_FRY_SETTINGS.earSafeLimitDb}
                accent="lime"
                onChange={(v) => onChange('earSafeLimitDb', v)}
              />
            </div>
          </>
        )}
      </div>

      {/* Bottom Export Dock */}
      <div className="border-t border-[#23232e] bg-[#0e0e13] p-3.5 space-y-2.5 shrink-0">
        {isExporting && exportProgress ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-[#ff9500]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {exportProgress.phase === 'preparing' && 'Preparing GPU pipeline...'}
                {exportProgress.phase === 'audio' && 'Deep-frying audio track...'}
                {exportProgress.phase === 'frames' &&
                  `Frying frame ${exportProgress.currentFrame}/${exportProgress.totalFrames}`}
                {exportProgress.phase === 'finalizing' && 'Muxing container...'}
              </span>
              <span className="font-mono text-[11px] text-[#a3e635]">
                {exportProgress.realtimeFactor > 0.2
                  ? `${exportProgress.realtimeFactor.toFixed(1)}× speed`
                  : `${Math.round(exportProgress.progress * 100)}%`}
              </span>
            </div>

            <div className="h-2.5 w-full rounded-full bg-[#1c1c24] overflow-hidden border border-[#2c2c38]">
              <div
                className="h-full bg-gradient-to-r from-[#ff6b1a] via-[#ff9500] to-[#ff2e4c] transition-all duration-150"
                style={{ width: `${Math.max(4, Math.round(exportProgress.progress * 100))}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-[#8d8880]">
                {exportProgress.elapsedSec.toFixed(1)}s elapsed · {exportProgress.engine.toUpperCase()}
              </span>
              <button
                type="button"
                onClick={onCancelExport}
                className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded bg-[#23171b] border border-[#ff2e4c]/50 text-[#ff6b81] hover:bg-[#ff2e4c]/20 cursor-pointer"
              >
                <Square className="h-2.5 w-2.5 fill-current" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {hasVideo && targetDims && (
              <div className="flex items-center justify-between text-[11px] font-mono text-[#9b978e]">
                <span>
                  {targetDims.width}×{targetDims.height} ·{' '}
                  {settings.fps > 0 ? `${settings.fps}fps` : 'Orig FPS'} ·{' '}
                  {settings.container.toUpperCase()}
                </span>
                <span className="text-[#a3e635] font-semibold">
                  ~{formatBytes(estBytes)}
                </span>
              </div>
            )}

            <button
              type="button"
              disabled={!hasVideo}
              onClick={onExport}
              className={`w-full py-3 px-4 rounded-xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer ${
                hasVideo
                  ? 'bg-gradient-to-r from-[#ff6b1a] via-[#ff551a] to-[#ff2e4c] text-white hover:brightness-110 fry-cta-glow'
                  : 'bg-[#1c1c24] text-[#5e5b55] border border-[#282832] cursor-not-allowed'
              }`}
            >
              <Flame className="h-4 w-4 fill-current" />
              <span>DEEP-FRY VIDEO</span>
              <Zap className="h-3.5 w-3.5 fill-current opacity-85" />
            </button>
          </>
        )}
      </div>
    </aside>
  );
};
