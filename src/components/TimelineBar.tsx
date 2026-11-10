import React, { useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Scissors,
  ShieldCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { formatTimecode } from '../types/fry';

interface TimelineBarProps {
  duration: number;
  currentTime: number;
  trimStart: number;
  trimEnd: number;
  isPlaying: boolean;
  waveform: Float32Array;
  hasAudio: boolean;
  includeAudio: boolean;
  volume01: number;
  playbackSpeed: number;
  onTogglePlay: () => void;
  onSeek: (timeSec: number) => void;
  onTrimChange: (start: number, end: number) => void;
  onVolumeChange: (vol: number) => void;
}

export const TimelineBar: React.FC<TimelineBarProps> = ({
  duration,
  currentTime,
  trimStart,
  trimEnd,
  isPlaying,
  waveform,
  hasAudio,
  includeAudio,
  volume01,
  playbackSpeed,
  onTogglePlay,
  onSeek,
  onTrimChange,
  onVolumeChange,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragMode, setDragMode] = useState<'scrub' | 'trim-start' | 'trim-end' | null>(null);

  const safeDur = Math.max(0.1, duration);
  const startPct = (trimStart / safeDur) * 100;
  const endPct = (trimEnd / safeDur) * 100;
  const playPct = Math.max(0, Math.min(100, (currentTime / safeDur) * 100));
  const trimLen = Math.max(0.1, trimEnd - trimStart);

  const timeFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    return frac * safeDur;
  };

  const handleTrackPointerDown = (
    e: React.PointerEvent,
    mode: 'scrub' | 'trim-start' | 'trim-end'
  ) => {
    e.stopPropagation();
    setDragMode(mode);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const t = timeFromClientX(e.clientX);
    if (mode === 'scrub') {
      onSeek(t);
    }
  };

  const handleTrackPointerMove = (e: React.PointerEvent) => {
    if (!dragMode) return;
    const t = timeFromClientX(e.clientX);
    const minSpan = Math.min(0.4, safeDur * 0.2);

    if (dragMode === 'scrub') {
      onSeek(t);
    } else if (dragMode === 'trim-start') {
      const nextStart = Math.max(0, Math.min(trimEnd - minSpan, t));
      onTrimChange(nextStart, trimEnd);
      if (currentTime < nextStart) onSeek(nextStart);
    } else if (dragMode === 'trim-end') {
      const nextEnd = Math.min(safeDur, Math.max(trimStart + minSpan, t));
      onTrimChange(trimStart, nextEnd);
      if (currentTime > nextEnd) onSeek(nextEnd);
    }
  };

  const handleTrackPointerUp = () => {
    setDragMode(null);
  };

  const bars = waveform.length > 0 ? Array.from(waveform) : new Array(100).fill(0.15);

  return (
    <div className="rounded-xl border border-[#24242e] bg-[#121217] p-3 space-y-2.5">
      {/* Waveform + Trim Scrubber */}
      <div
        ref={trackRef}
        onPointerDown={(e) => handleTrackPointerDown(e, 'scrub')}
        onPointerMove={handleTrackPointerMove}
        onPointerUp={handleTrackPointerUp}
        className="relative h-14 rounded-lg bg-[#0b0b0f] border border-[#23232d] overflow-hidden cursor-ew-resize select-none touch-none"
      >
        {/* Waveform Bars */}
        <div className="absolute inset-0 flex items-center justify-between gap-[1.5px] px-1.5 pointer-events-none">
          {bars.map((amp, i) => {
            const pct = (i / Math.max(1, bars.length - 1)) * 100;
            const insideTrim = pct >= startPct && pct <= endPct;
            const played = pct <= playPct;
            const hPct = Math.max(8, Math.round(amp * 86));
            return (
              <div
                key={i}
                className="flex-1 rounded-full transition-colors duration-75"
                style={{
                  height: `${hPct}%`,
                  backgroundColor: !insideTrim
                    ? '#23232c'
                    : played
                    ? '#ff6b1a'
                    : '#5c5952',
                }}
              />
            );
          })}
        </div>

        {/* Dimmed left & right trimmed regions */}
        <div
          className="absolute inset-y-0 left-0 bg-black/55 pointer-events-none"
          style={{ width: `${startPct}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-black/55 pointer-events-none"
          style={{ width: `${100 - endPct}%` }}
        />

        {/* Active Trim Region Borders */}
        <div
          className="absolute inset-y-0 border-y-2 border-[#ff9500]/70 pointer-events-none"
          style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
        />

        {/* Trim Start Handle */}
        <div
          onPointerDown={(e) => handleTrackPointerDown(e, 'trim-start')}
          onPointerMove={handleTrackPointerMove}
          onPointerUp={handleTrackPointerUp}
          title="Drag to trim start"
          className="absolute inset-y-0 w-3 -translate-x-1/2 z-20 cursor-ew-resize flex items-center justify-center group"
          style={{ left: `${startPct}%` }}
        >
          <div className="h-full w-1.5 bg-[#ff9500] group-hover:bg-white rounded-l shadow" />
        </div>

        {/* Trim End Handle */}
        <div
          onPointerDown={(e) => handleTrackPointerDown(e, 'trim-end')}
          onPointerMove={handleTrackPointerMove}
          onPointerUp={handleTrackPointerUp}
          title="Drag to trim end"
          className="absolute inset-y-0 w-3 -translate-x-1/2 z-20 cursor-ew-resize flex items-center justify-center group"
          style={{ left: `${endPct}%` }}
        >
          <div className="h-full w-1.5 bg-[#ff9500] group-hover:bg-white rounded-r shadow" />
        </div>

        {/* Playhead */}
        <div
          className="absolute inset-y-0 w-[2px] bg-white shadow-[0_0_8px_#ffffff] z-30 pointer-events-none"
          style={{ left: `${playPct}%` }}
        >
          <div className="w-2.5 h-2.5 -ml-[4px] -mt-0.5 rounded-full bg-white" />
        </div>
      </div>

      {/* Transport & Volume Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onTogglePlay}
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-[#ff6b1a] text-black hover:bg-[#ff813b] transition-colors cursor-pointer shadow"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 fill-current" />
            ) : (
              <Play className="h-4 w-4 fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onSeek(Math.max(trimStart, currentTime - 1 / 24))}
            className="p-1.5 rounded-lg bg-[#1a1a22] border border-[#2a2a36] text-[#c7c2b8] hover:text-white transition-colors cursor-pointer"
            title="Step back 1 frame"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onSeek(Math.min(trimEnd, currentTime + 1 / 24))}
            className="p-1.5 rounded-lg bg-[#1a1a22] border border-[#2a2a36] text-[#c7c2b8] hover:text-white transition-colors cursor-pointer"
            title="Step forward 1 frame"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="ml-1.5 flex items-center gap-2 font-mono text-[11px] tabular-nums">
            <span className="text-[#f5f2eb] font-semibold">{formatTimecode(currentTime)}</span>
            <span className="text-[#69665f]">/</span>
            <span className="text-[#9b978e]">{formatTimecode(duration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {(trimStart > 0.05 || trimEnd < duration - 0.05) && (
            <button
              type="button"
              onClick={() => onTrimChange(0, duration)}
              className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-[#ff9500]/15 border border-[#ff9500]/40 text-[#ffb144] hover:bg-[#ff9500]/25 transition-colors cursor-pointer"
              title="Click to reset trim range"
            >
              <Scissors className="h-3 w-3" />
              <span>
                {formatTimecode(trimLen)}
                {Math.abs(playbackSpeed - 1) > 0.02 &&
                  ` → ${formatTimecode(trimLen / playbackSpeed)}`}
              </span>
            </button>
          )}

          {hasAudio && (
            <div className="flex items-center gap-2">
              <span
                className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-[#a3e635] bg-[#a3e635]/10 border border-[#a3e635]/25 px-1.5 py-0.5 rounded"
                title="Output safety limiter protects your speakers even at +36dB overdrive"
              >
                <ShieldCheck className="h-3 w-3" />
                Safe Limiter
              </span>
              <button
                type="button"
                onClick={() => onVolumeChange(volume01 > 0 ? 0 : 0.7)}
                className="p-1 text-[#b7b2a8] hover:text-white cursor-pointer"
                title={volume01 === 0 || !includeAudio ? 'Unmute preview' : 'Mute preview'}
              >
                {volume01 === 0 || !includeAudio ? (
                  <VolumeX className="h-4 w-4 text-[#ff2e4c]" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={includeAudio ? volume01 : 0}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="fry-slider w-16 sm:w-20 h-4"
                style={
                  {
                    '--slider-pct': `${(includeAudio ? volume01 : 0) * 100}%`,
                    '--slider-color': '#a3e635',
                  } as React.CSSProperties
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
