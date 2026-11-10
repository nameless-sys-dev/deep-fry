import React from 'react';
import {
  Camera,
  Dices,
  Flame,
  RotateCcw,
  Upload,
  Zap,
} from 'lucide-react';
import { FRY_PRESETS, FryPreset } from '../types/fry';

interface HeaderBarProps {
  activePresetId: string | null;
  onSelectPreset: (preset: FryPreset) => void;
  onRandomize: () => void;
  onReset: () => void;
  onUploadClick: () => void;
  onWebcamClick: () => void;
  hasVideo: boolean;
  webCodecsReady: boolean;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  activePresetId,
  onSelectPreset,
  onRandomize,
  onReset,
  onUploadClick,
  onWebcamClick,
  hasVideo,
  webCodecsReady,
}) => {
  return (
    <header className="border-b border-[#25252f] bg-[#101014]/95 backdrop-blur-md px-3 sm:px-5 py-2.5">
      <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#ff6b1a] to-[#ff2e4c] shadow-lg shadow-[#ff6b1a]/25">
            <Flame className="h-5 w-5 text-white fill-white/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#f5f2eb]">
                DEEPFRY<span className="text-[#ff6b1a]">.LAB</span>
              </h1>
              <span
                className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border border-[#2c2c38] bg-[#18181f] text-[#a3e635]"
                title={
                  webCodecsReady
                    ? 'Hardware-accelerated WebCodecs GPU encoding active'
                    : 'Running MediaRecorder browser fallback'
                }
              >
                <Zap className="h-2.5 w-2.5 fill-current" />
                {webCodecsReady ? 'WebCodecs GPU' : 'Browser Fallback'}
              </span>
            </div>
            <p className="text-[11px] text-[#8e8a81] hidden md:block">
              100% client-side video & audio over-compression studio
            </p>
          </div>
        </div>

        {/* Preset Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full order-3 lg:order-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#78746c] mr-1 hidden xl:inline">
            Presets:
          </span>
          {FRY_PRESETS.map((preset) => {
            const active = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectPreset(preset)}
                title={preset.tagline}
                className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 border cursor-pointer ${
                  active
                    ? 'bg-[#ff6b1a]/18 border-[#ff6b1a] text-[#fff6ee] shadow-sm shadow-[#ff6b1a]/20'
                    : 'bg-[#17171d] border-[#272732] text-[#b8b3a9] hover:border-[#414154] hover:text-white'
                }`}
              >
                <span>{preset.name}</span>
                <span
                  className={`font-mono text-[9px] px-1 py-0.2 rounded ${
                    active
                      ? 'bg-[#ff6b1a] text-black font-bold'
                      : 'bg-[#23232c] text-[#8e8a81] group-hover:text-[#d5d0c6]'
                  }`}
                >
                  {preset.badge}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={onRandomize}
            title="Randomize deep-fry settings"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#ff2e4c]/20 to-[#ff6b1a]/20 border border-[#ff4d36]/45 text-[#ff8a65] hover:text-white hover:border-[#ff6b1a] transition-all shrink-0 cursor-pointer"
          >
            <Dices className="h-3.5 w-3.5" />
            <span>Chaos</span>
          </button>
        </div>

        {/* Right File Actions */}
        <div className="flex items-center gap-2 order-2 lg:order-3">
          {hasVideo && (
            <button
              type="button"
              onClick={onReset}
              title="Reset settings to default"
              className="p-2 rounded-lg bg-[#17171d] border border-[#272732] text-[#a6a197] hover:text-white hover:border-[#3e3e4d] transition-colors cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onWebcamClick}
            title="Record a quick webcam clip"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#17171d] border border-[#2a2a36] text-[#d9d5cb] hover:border-[#ff6b1a]/60 hover:text-white transition-colors cursor-pointer"
          >
            <Camera className="h-3.5 w-3.5 text-[#ff6b1a]" />
            <span className="hidden sm:inline">Webcam</span>
          </button>
          <button
            type="button"
            onClick={onUploadClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#f5f2eb] text-[#0d0d10] hover:bg-white transition-colors cursor-pointer shadow-sm"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>{hasVideo ? 'Change Video' : 'Load Video'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
