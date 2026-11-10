import React, { useRef, useState } from 'react';
import {
  Camera,
  Columns2,
  Eye,
  Film,
  Flame,
  Loader2,
  Sparkles,
  Upload,
} from 'lucide-react';
import {
  computeTargetDimensions,
  estimateOutputSizeBytes,
  formatBytes,
  FrySettings,
  VideoMetadata,
} from '../types/fry';
import { DEMO_CLIPS, DemoClipMeta } from '../engine/demoGenerator';

interface ViewportStageProps {
  hasVideo: boolean;
  metadata: VideoMetadata | null;
  settings: FrySettings;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  splitEnabled: boolean;
  splitPos: number;
  bypassActive: boolean;
  onToggleSplit: () => void;
  onSplitPosChange: (pos: number) => void;
  onBypassChange: (active: boolean) => void;
  onFlareMove: (x: number, y: number) => void;
  onFileDrop: (file: File) => void;
  onUploadClick: () => void;
  onLoadDemo: (id: DemoClipMeta['id']) => void;
  onWebcamClick: () => void;
  loadingDemoId: string | null;
  trimDuration: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

export const ViewportStage: React.FC<ViewportStageProps> = ({
  hasVideo,
  metadata,
  settings,
  canvasRef,
  splitEnabled,
  splitPos,
  bypassActive,
  onToggleSplit,
  onSplitPosChange,
  onBypassChange,
  onFlareMove,
  onFileDrop,
  onUploadClick,
  onLoadDemo,
  onWebcamClick,
  loadingDemoId,
  trimDuration,
  onTogglePlay,
}) => {
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [draggingSplit, setDraggingSplit] = useState(false);
  const [draggingFlare, setDraggingFlare] = useState(false);
  const stageBoxRef = useRef<HTMLDivElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onFileDrop(file);
    }
  };

  const getNormalizedCoords = (clientX: number, clientY: number) => {
    const el = canvasRef.current ?? stageBoxRef.current;
    if (!el) return { x: 0.5, y: 0.5 };
    const rect = el.getBoundingClientRect();
    const x = Math.max(0.02, Math.min(0.98, (clientX - rect.left) / Math.max(1, rect.width)));
    const y = Math.max(0.02, Math.min(0.98, (clientY - rect.top) / Math.max(1, rect.height)));
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!hasVideo) return;
    const { x, y } = getNormalizedCoords(e.clientX, e.clientY);

    if (splitEnabled && Math.abs(x - splitPos) < 0.06) {
      setDraggingSplit(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (settings.lensFlare && (!splitEnabled || x > splitPos)) {
      setDraggingFlare(true);
      onFlareMove(x, y);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingSplit && !draggingFlare) return;
    const { x, y } = getNormalizedCoords(e.clientX, e.clientY);
    if (draggingSplit) {
      onSplitPosChange(Math.max(0.05, Math.min(0.95, x)));
    } else if (draggingFlare) {
      onFlareMove(x, y);
    }
  };

  const handlePointerUp = () => {
    setDraggingSplit(false);
    setDraggingFlare(false);
  };

  const targetDims = metadata
    ? computeTargetDimensions(metadata.width, metadata.height, settings.scalePercent)
    : { width: 0, height: 0 };

  const estBytes = metadata ? estimateOutputSizeBytes(trimDuration, settings) : 0;
  const fullEstBytes =
    metadata && metadata.duration > 0
      ? Math.round(metadata.sizeBytes * (trimDuration / metadata.duration))
      : 0;
  const savingsPct =
    fullEstBytes > 0 ? Math.round(((fullEstBytes - estBytes) / fullEstBytes) * 100) : 0;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex-1 min-h-[300px] sm:min-h-[380px] rounded-xl border transition-all overflow-hidden flex flex-col bg-[#09090c] ${
        isDraggingFile
          ? 'border-[#ff6b1a] bg-[#ff6b1a]/10 ring-2 ring-[#ff6b1a]/40'
          : 'border-[#24242e]'
      }`}
    >
      {/* Top Viewport Toolbar (when video loaded) */}
      {hasVideo && metadata && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#121217] border-b border-[#22222b] z-10">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#d8d4ca] truncate max-w-[210px] sm:max-w-[280px]">
              <Film className="h-3.5 w-3.5 text-[#ff6b1a] shrink-0" />
              <span className="truncate">{metadata.name}</span>
            </span>
            <span className="hidden sm:inline font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#1b1b23] text-[#9b978f] border border-[#292934]">
              {metadata.width}×{metadata.height} →{' '}
              <strong className="text-[#ff9500]">
                {targetDims.width}×{targetDims.height}
              </strong>{' '}
              @ {settings.fps > 0 ? `${settings.fps}fps` : `${Math.round(metadata.fps)}fps`}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className="hidden md:inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded bg-[#181820] border border-[#2a2a36] text-[#c7c2b7]"
              title="Estimated compressed output size"
            >
              Est: <strong className="text-[#a3e635]">{formatBytes(estBytes)}</strong>
              {savingsPct > 0 && (
                <span className="text-[#ff8a3d]">(-{savingsPct}%)</span>
              )}
            </span>

            <button
              type="button"
              onClick={onToggleSplit}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
                splitEnabled
                  ? 'bg-[#ff6b1a]/20 border-[#ff6b1a] text-[#fff3e8]'
                  : 'bg-[#1a1a22] border-[#2c2c38] text-[#b4afa5] hover:text-white'
              }`}
              title="Toggle Before / After Split Divider"
            >
              <Columns2 className="h-3.5 w-3.5" />
              <span>Split</span>
            </button>

            <button
              type="button"
              onPointerDown={() => onBypassChange(true)}
              onPointerUp={() => onBypassChange(false)}
              onPointerLeave={() => onBypassChange(false)}
              onPointerCancel={() => onBypassChange(false)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer select-none ${
                bypassActive
                  ? 'bg-[#a3e635]/20 border-[#a3e635] text-[#ecfccb]'
                  : 'bg-[#1a1a22] border-[#2c2c38] text-[#b4afa5] hover:text-white'
              }`}
              title="Press & hold to view raw original"
            >
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Hold Original</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Canvas Stage or Empty Dropzone */}
      {hasVideo ? (
        <div
          ref={stageBoxRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={onTogglePlay}
          className="relative flex-1 flex items-center justify-center p-2 sm:p-4 overflow-hidden select-none bg-[radial-gradient(#1b1b22_1px,transparent_1px)] [background-size:18px_18px]"
        >
          <div className="relative flex items-center justify-center max-w-full max-h-full shadow-2xl shadow-black/80 rounded-lg overflow-hidden border border-[#262630]">
            <canvas
              ref={canvasRef}
              className="block max-w-full max-h-[52vh] lg:max-h-[58vh] w-auto h-auto object-contain bg-black"
              style={{
                aspectRatio: metadata ? `${metadata.width} / ${metadata.height}` : undefined,
                imageRendering: settings.scaleMode === 'blocky' ? 'pixelated' : 'auto',
              }}
            />

            {/* Split Compare Vertical Line Overlay */}
            {splitEnabled && !bypassActive && (
              <div
                className="absolute inset-y-0 z-20 pointer-events-none"
                style={{ left: `${splitPos * 100}%` }}
              >
                <div className="absolute inset-y-0 -translate-x-1/2 w-[2px] bg-white shadow-[0_0_8px_rgba(0,0,0,0.9)]" />
                <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-[#111116]/90 border-2 border-white flex items-center justify-center shadow-lg">
                  <Columns2 className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="absolute top-2 right-2 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/75 text-white border border-white/20">
                  RAW
                </span>
                <span className="absolute top-2 left-2 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#ff6b1a]/90 text-black">
                  FRIED
                </span>
              </div>
            )}

            {/* Draggable Lens Flare Target Indicator */}
            {settings.lensFlare && !bypassActive && (
              <div
                className="absolute z-10 pointer-events-none -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${settings.flareX * 100}%`,
                  top: `${settings.flareY * 100}%`,
                }}
              >
                <div className="h-5 w-5 rounded-full border border-[#ff9500]/80 bg-[#ff6b1a]/20 animate-ping opacity-50" />
              </div>
            )}

            {/* Bypass Badge */}
            {bypassActive && (
              <div className="absolute top-2.5 left-2.5 z-20 font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-[#a3e635] text-black shadow">
                ORIGINAL RAW BYPASS
              </div>
            )}

            {/* JPEG Pass Indicator */}
            {settings.jpegPasses > 0 && !bypassActive && (
              <div className="absolute bottom-2 right-2 z-10 font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/70 border border-[#ff6b1a]/40 text-[#ff9500]">
                JPEG ×{settings.jpegPasses} (Q{settings.jpegQuality}%)
              </div>
            )}
          </div>

          {settings.lensFlare && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/70 border border-[#2f2f3b] text-[#d5d0c6]">
              Tip: Drag anywhere on frame to move laser flare
            </div>
          )}
        </div>
      ) : (
        /* Empty Dropzone + Demo Launcher */
        <div className="flex-1 flex flex-col items-center justify-center p-5 sm:p-8 text-center">
          <div className="max-w-lg w-full space-y-6">
            <div
              onClick={onUploadClick}
              className="group cursor-pointer rounded-2xl border-2 border-dashed border-[#323240] hover:border-[#ff6b1a] bg-[#121217]/80 hover:bg-[#17171e] p-7 sm:p-9 transition-all"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff6b1a]/20 to-[#ff2e4c]/20 border border-[#ff6b1a]/40 group-hover:scale-105 transition-transform">
                <Upload className="h-7 w-7 text-[#ff6b1a]" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-[#f5f2eb]">
                Drop a video to deep-fry
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-[#9b978e]">
                MP4, WebM, MOV, MKV — processed 100% locally in your browser with GPU WebCodecs
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#ff6b1a] text-black shadow-md shadow-[#ff6b1a]/25">
                  <Flame className="h-3.5 w-3.5 fill-current" />
                  Choose Video File
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onWebcamClick();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#1c1c25] border border-[#2f2f3d] text-[#e6e1d7] hover:border-[#ff6b1a]/60 transition-colors cursor-pointer"
                >
                  <Camera className="h-3.5 w-3.5 text-[#ff6b1a]" />
                  Record Webcam
                </button>
              </div>
            </div>

            {/* Instant Demo Clips */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#8e8a81]">
                <Sparkles className="h-3.5 w-3.5 text-[#ff9500]" />
                <span>Or generate an instant demo clip</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {DEMO_CLIPS.map((demo) => {
                  const busy = loadingDemoId === demo.id;
                  return (
                    <button
                      key={demo.id}
                      type="button"
                      disabled={loadingDemoId !== null}
                      onClick={() => onLoadDemo(demo.id)}
                      className="text-left p-3 rounded-xl bg-[#14141a] border border-[#262632] hover:border-[#ff6b1a]/70 hover:bg-[#1a1a22] transition-all cursor-pointer disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#f5f2eb]">
                          {demo.title}
                        </span>
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#ff6b1a]" />
                        ) : (
                          <span className="font-mono text-[10px] text-[#ff9500]">
                            {demo.durationLabel}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-[#8d8880] leading-snug">
                        {demo.subtitle}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drag-over backdrop */}
      {isDraggingFile && hasVideo && (
        <div className="absolute inset-0 z-30 bg-[#0b0b0e]/85 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none">
          <Upload className="h-12 w-12 text-[#ff6b1a] mb-2 animate-bounce" />
          <p className="text-base font-bold text-white">Drop to replace current video</p>
        </div>
      )}
    </div>
  );
};
