import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { ControlRack } from './components/ControlRack';
import { ExportModal } from './components/ExportModal';
import { HeaderBar } from './components/HeaderBar';
import { TimelineBar } from './components/TimelineBar';
import { ViewportStage } from './components/ViewportStage';
import { WebcamModal } from './components/WebcamModal';
import {
  decodeAudioFromFile,
  extractWaveformAndEnvelope,
  LiveAudioController,
  sampleEnvelopeAtTime,
} from './engine/audioFryer';
import { DemoClipMeta, generateDemoVideoFile } from './engine/demoGenerator';
import { JpegCruncher } from './engine/jpegCrunch';
import {
  exportDeepFriedVideo,
  inspectVideoFile,
  isWebCodecsSupported,
} from './engine/videoExporter';
import { WebGLFryer } from './engine/webglFryer';
import {
  computeTargetDimensions,
  ControlTab,
  DEFAULT_FRY_SETTINGS,
  ExportProgress,
  ExportResult,
  FryPreset,
  FrySettings,
  randomizeFrySettings,
  VideoMetadata,
} from './types/fry';

export default function App() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [waveform, setWaveform] = useState<Float32Array>(() => new Float32Array(160));
  const [envelope60Hz, setEnvelope60Hz] = useState<Float32Array>(() => new Float32Array(1));

  const [settings, setSettings] = useState<FrySettings>(DEFAULT_FRY_SETTINGS);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ControlTab>('compression');

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(1);
  const [volume01, setVolume01] = useState(0.7);

  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitPos, setSplitPos] = useState(0.5);
  const [bypassActive, setBypassActive] = useState(false);

  const [loadingDemoId, setLoadingDemoId] = useState<string | null>(null);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fryerRef = useRef<WebGLFryer | null>(null);
  const liveAudioRef = useRef<LiveAudioController | null>(null);
  const jpegPreviewRef = useRef<JpegCruncher | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Live mutable refs for the 60fps animation loop
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const metaRef = useRef(metadata);
  metaRef.current = metadata;
  const splitRef = useRef({ enabled: splitEnabled, pos: splitPos });
  splitRef.current = { enabled: splitEnabled, pos: splitPos };
  const bypassRef = useRef(bypassActive);
  bypassRef.current = bypassActive;
  const trimRef = useRef({ start: trimStart, end: trimEnd });
  trimRef.current = { start: trimStart, end: trimEnd };
  const envRef = useRef(envelope60Hz);
  envRef.current = envelope60Hz;
  const playingRef = useRef(isPlaying);
  playingRef.current = isPlaying;

  const webCodecsReady = isWebCodecsSupported();

  // Cleanup URLs & controllers on unmount
  useEffect(() => {
    return () => {
      liveAudioRef.current?.dispose();
      fryerRef.current?.dispose();
    };
  }, []);

  // Load any File (upload, webcam, demo, or recursive re-fry)
  const loadVideoFile = useCallback(
    async (file: File) => {
      setErrorMsg(null);
      setIsPlaying(false);

      try {
        const meta = await inspectVideoFile(file);
        const nextUrl = URL.createObjectURL(file);

        setVideoUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return nextUrl;
        });
        setVideoFile(file);
        setMetadata(meta);
        setTrimStart(0);
        setTrimEnd(meta.duration);
        setCurrentTime(0);

        // Decode audio asynchronously for waveform, envelope & offline export
        const decoded = await decodeAudioFromFile(file);
        setAudioBuffer(decoded);
        const analysis = extractWaveformAndEnvelope(decoded, 160, 60);
        setWaveform(analysis.waveform);
        setEnvelope60Hz(analysis.envelope60Hz);
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : 'Failed to load video file.'
        );
      }
    },
    []
  );

  // Initialize WebGLFryer whenever canvas mounts for a loaded video
  useEffect(() => {
    if (!metadata || !canvasRef.current) return;
    const fryer = new WebGLFryer(canvasRef.current);
    fryerRef.current = fryer;
    if (!jpegPreviewRef.current) {
      jpegPreviewRef.current = new JpegCruncher();
    }
    return () => {
      fryer.dispose();
      if (fryerRef.current === fryer) {
        fryerRef.current = null;
      }
    };
  }, [metadata]);

  // Helper: render single preview frame onto WebGL2 canvas
  const drawPreviewFrame = useCallback((withRealJpeg = false) => {
    const vid = videoRef.current;
    const fryer = fryerRef.current;
    const meta = metaRef.current;
    if (!vid || !fryer || !meta || vid.readyState < 2) return;

    const s = settingsRef.current;
    const srcW = vid.videoWidth || meta.width;
    const srcH = vid.videoHeight || meta.height;
    const target = computeTargetDimensions(srcW, srcH, s.scalePercent);

    // Keep preview display canvas sharp enough to show blocky pixels cleanly
    const previewW = Math.max(target.width, Math.min(srcW, 720));
    const previewH = Math.max(2, Math.round((previewW * srcH) / Math.max(1, srcW) / 2) * 2);

    const t = vid.currentTime || 0;
    const envBass = sampleEnvelopeAtTime(envRef.current, t);
    const liveBass = playingRef.current ? (liveAudioRef.current?.getLiveBassLevel() ?? 0) : 0;
    const bassLevel = Math.max(envBass, liveBass);

    // Simulate extra JPEG blockiness subtly in real-time preview when jpegPasses > 0
    const previewSettings: FrySettings =
      !withRealJpeg && s.jpegPasses > 0
        ? {
            ...s,
            blockArtifact: Math.min(
              1,
              s.blockArtifact + s.jpegPasses * 0.14 + (1 - s.jpegQuality / 60) * 0.18
            ),
          }
        : s;

    const staged = fryer.composeStaging(
      vid,
      target.width,
      target.height,
      previewSettings,
      t,
      bassLevel
    );

    fryer.renderFrame({
      friedInput: staged as TexImageSource & CanvasImageSource,
      rawInput: vid,
      outputWidth: previewW,
      outputHeight: previewH,
      targetResWidth: target.width,
      targetResHeight: target.height,
      settings: previewSettings,
      timeSec: t,
      bassLevel,
      splitPos: splitRef.current.enabled ? splitRef.current.pos : 0,
      bypass: bypassRef.current,
    });
  }, []);

  // Real-time 60fps animation loop (throttled to settings.fps during playback)
  useEffect(() => {
    if (!metadata) return;
    let rafId = 0;
    let lastDrawMs = 0;

    const tick = (now: number) => {
      const vid = videoRef.current;
      if (vid && vid.readyState >= 2) {
        const s = settingsRef.current;
        const { start, end } = trimRef.current;

        if (!vid.paused && !vid.ended) {
          // Enforce trim loop
          if (vid.currentTime >= end - 0.025 || vid.currentTime < start - 0.15) {
            vid.currentTime = start;
          }
          setCurrentTime(vid.currentTime);

          const effectiveFps = s.fps > 0 ? s.fps : 60;
          const intervalMs = 1000 / effectiveFps;
          if (now - lastDrawMs >= intervalMs) {
            lastDrawMs = now;
            drawPreviewFrame(false);
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [metadata, drawPreviewFrame]);

  // Re-render paused frame immediately whenever sliders/split/bypass change + optional real JPEG preview
  useEffect(() => {
    if (!metadata) return;
    drawPreviewFrame(false);

    if (isPlaying || settings.jpegPasses <= 0 || bypassActive) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const vid = videoRef.current;
      const fryer = fryerRef.current;
      const cruncher = jpegPreviewRef.current;
      if (!vid || !fryer || !cruncher || vid.readyState < 2) return;

      const srcW = vid.videoWidth || metadata.width;
      const srcH = vid.videoHeight || metadata.height;
      const target = computeTargetDimensions(srcW, srcH, settings.scalePercent);
      const previewW = Math.max(target.width, Math.min(srcW, 720));
      const previewH = Math.max(2, Math.round((previewW * srcH) / Math.max(1, srcW) / 2) * 2);

      const t = vid.currentTime || 0;
      const bassLevel = sampleEnvelopeAtTime(envelope60Hz, t);
      const staged = fryer.composeStaging(vid, target.width, target.height, settings, t, bassLevel);
      fryer.renderFrame({
        friedInput: staged as TexImageSource & CanvasImageSource,
        rawInput: vid,
        outputWidth: previewW,
        outputHeight: previewH,
        targetResWidth: target.width,
        targetResHeight: target.height,
        settings,
        timeSec: t,
        bassLevel,
        splitPos: splitEnabled ? splitPos : 0,
        bypass: false,
      });

      const crunched = await cruncher.crunch(
        fryer.outputCanvas,
        target.width,
        target.height,
        settings.jpegPasses,
        settings.jpegQuality
      );
      if (cancelled) return;

      fryer.renderFrame({
        friedInput: crunched as TexImageSource & CanvasImageSource,
        rawInput: vid,
        outputWidth: previewW,
        outputHeight: previewH,
        targetResWidth: target.width,
        targetResHeight: target.height,
        settings,
        timeSec: t,
        bassLevel,
        splitPos: splitEnabled ? splitPos : 0,
        bypass: false,
        passthruFried: true,
      });
    }, 55);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    metadata,
    settings,
    splitEnabled,
    splitPos,
    bypassActive,
    isPlaying,
    currentTime,
    envelope60Hz,
    drawPreviewFrame,
  ]);

  // Sync Web Audio FX parameters & playback speed
  useEffect(() => {
    const vid = videoRef.current;
    if (vid) {
      vid.playbackRate = Math.max(0.5, Math.min(2.5, settings.playbackSpeed));
    }
    liveAudioRef.current?.update(settings, volume01, bypassActive);
  }, [settings, volume01, bypassActive]);

  const ensureLiveAudioAttached = useCallback(async () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (!liveAudioRef.current) {
      liveAudioRef.current = new LiveAudioController();
    }
    await liveAudioRef.current.attach(vid, settingsRef.current, volume01, bypassRef.current);
    await liveAudioRef.current.resume();
  }, [volume01]);

  const handleTogglePlay = useCallback(async () => {
    const vid = videoRef.current;
    if (!vid || !metadata) return;

    if (vid.paused || vid.ended) {
      await ensureLiveAudioAttached();
      if (vid.currentTime < trimStart || vid.currentTime >= trimEnd - 0.05) {
        vid.currentTime = trimStart;
      }
      vid.playbackRate = Math.max(0.5, Math.min(2.5, settingsRef.current.playbackSpeed));
      await vid.play().catch(() => {});
      setIsPlaying(true);
    } else {
      vid.pause();
      setIsPlaying(false);
    }
  }, [metadata, trimStart, trimEnd, ensureLiveAudioAttached]);

  const handleSeek = useCallback(
    (t: number) => {
      const vid = videoRef.current;
      if (!vid) return;
      const clamped = Math.max(0, Math.min(metadata?.duration ?? t, t));
      vid.currentTime = clamped;
      setCurrentTime(clamped);
    },
    [metadata]
  );

  // Spacebar play/pause shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
      if (!metadata) return;
      e.preventDefault();
      void handleTogglePlay();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [metadata, handleTogglePlay]);

  const updateSetting = useCallback(
    <K extends keyof FrySettings>(key: K, value: FrySettings[K]) => {
      setActivePresetId(null);
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const batchUpdateSettings = useCallback((patch: Partial<FrySettings>) => {
    setActivePresetId(null);
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSelectPreset = useCallback((preset: FryPreset) => {
    setActivePresetId(preset.id);
    setSettings((prev) => ({ ...prev, ...preset.settings }));
  }, []);

  const handleRandomize = useCallback(() => {
    setActivePresetId(null);
    setSettings((prev) => randomizeFrySettings(prev));
  }, []);

  const handleReset = useCallback(() => {
    setActivePresetId(null);
    setSettings(DEFAULT_FRY_SETTINGS);
  }, []);

  const handleLoadDemo = useCallback(
    async (demoId: DemoClipMeta['id']) => {
      setLoadingDemoId(demoId);
      setErrorMsg(null);
      try {
        const file = await generateDemoVideoFile(demoId);
        await loadVideoFile(file);
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : 'Could not synthesize demo clip.'
        );
      } finally {
        setLoadingDemoId(null);
      }
    },
    [loadVideoFile]
  );

  const handleExport = useCallback(async () => {
    if (!videoFile || !metadata || isExporting) return;

    // Pause live preview during export so GPU & audio focus 100% on export
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
      setIsPlaying(false);
    }

    const ac = new AbortController();
    abortControllerRef.current = ac;
    setIsExporting(true);
    setErrorMsg(null);
    setExportProgress({
      phase: 'preparing',
      progress: 0.01,
      currentFrame: 0,
      totalFrames: 1,
      elapsedSec: 0,
      realtimeFactor: 0,
      engine: webCodecsReady ? 'webcodecs' : 'mediarecorder',
    });

    try {
      const result = await exportDeepFriedVideo({
        file: videoFile,
        metadata,
        audioBuffer,
        envelope60Hz,
        settings,
        trimStart,
        trimEnd,
        signal: ac.signal,
        onProgress: setExportProgress,
      });

      setExportResult((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return result;
      });
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setErrorMsg(
          err instanceof Error ? err.message : 'Deep-fry export failed.'
        );
      }
    } finally {
      setIsExporting(false);
      setExportProgress(null);
      abortControllerRef.current = null;
    }
  }, [
    videoFile,
    metadata,
    isExporting,
    webCodecsReady,
    audioBuffer,
    envelope60Hz,
    settings,
    trimStart,
    trimEnd,
  ]);

  const handleCancelExport = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0b0e] text-[#f5f2eb]">
      {/* Hidden File Input & Playback Video Source */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,.mp4,.webm,.mov,.mkv,.avi,.m4v"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void loadVideoFile(f);
          e.target.value = '';
        }}
      />

      {videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          loop
          preload="auto"
          className="hidden"
          onLoadedData={() => {
            drawPreviewFrame(false);
          }}
          onSeeked={() => {
            drawPreviewFrame(false);
          }}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* Top Studio Header */}
      <HeaderBar
        activePresetId={activePresetId}
        onSelectPreset={handleSelectPreset}
        onRandomize={handleRandomize}
        onReset={handleReset}
        onUploadClick={() => fileInputRef.current?.click()}
        onWebcamClick={() => setWebcamOpen(true)}
        hasVideo={Boolean(metadata)}
        webCodecsReady={webCodecsReady}
      />

      {/* Error Banner */}
      {errorMsg && (
        <div className="max-w-[1600px] w-full mx-auto px-3 sm:px-5 pt-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#ff2e4c]/50 bg-[#ff2e4c]/12 px-4 py-2.5 text-xs text-[#ffd2d9]">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-[#ff2e4c] shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="p-1 hover:text-white cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Studio Grid */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-[1fr_410px] xl:grid-cols-[1fr_440px] gap-4 items-stretch">
        {/* Left Stage + Timeline */}
        <div className="flex flex-col gap-3 min-w-0">
          <ViewportStage
            hasVideo={Boolean(metadata)}
            metadata={metadata}
            settings={settings}
            canvasRef={canvasRef}
            splitEnabled={splitEnabled}
            splitPos={splitPos}
            bypassActive={bypassActive}
            onToggleSplit={() => setSplitEnabled((v) => !v)}
            onSplitPosChange={setSplitPos}
            onBypassChange={setBypassActive}
            onFlareMove={(x, y) => batchUpdateSettings({ flareX: x, flareY: y })}
            onFileDrop={(f) => void loadVideoFile(f)}
            onUploadClick={() => fileInputRef.current?.click()}
            onLoadDemo={(id) => void handleLoadDemo(id)}
            onWebcamClick={() => setWebcamOpen(true)}
            loadingDemoId={loadingDemoId}
            trimDuration={Math.max(0.2, trimEnd - trimStart)}
            isPlaying={isPlaying}
            onTogglePlay={() => void handleTogglePlay()}
          />

          {metadata && (
            <TimelineBar
              duration={metadata.duration}
              currentTime={currentTime}
              trimStart={trimStart}
              trimEnd={trimEnd}
              isPlaying={isPlaying}
              waveform={waveform}
              hasAudio={metadata.hasAudio && Boolean(audioBuffer)}
              includeAudio={settings.includeAudio}
              volume01={volume01}
              playbackSpeed={settings.playbackSpeed}
              onTogglePlay={() => void handleTogglePlay()}
              onSeek={handleSeek}
              onTrimChange={(s, e) => {
                setTrimStart(s);
                setTrimEnd(e);
              }}
              onVolumeChange={(v) => {
                setVolume01(v);
                if (v > 0 && !settings.includeAudio) {
                  updateSetting('includeAudio', true);
                }
              }}
            />
          )}
        </div>

        {/* Right FX Workstation Rack */}
        <ControlRack
          activeTab={activeTab}
          onTabChange={setActiveTab}
          settings={settings}
          onChange={updateSetting}
          onBatchChange={batchUpdateSettings}
          metadata={metadata}
          trimDuration={metadata ? Math.max(0.2, trimEnd - trimStart) : 0}
          hasVideo={Boolean(metadata)}
          isExporting={isExporting}
          exportProgress={exportProgress}
          onExport={() => void handleExport()}
          onCancelExport={handleCancelExport}
        />
      </main>

      {/* Export Showcase Modal */}
      <ExportModal
        result={exportResult}
        onClose={() => setExportResult(null)}
        onReFry={(file) => {
          void loadVideoFile(file);
        }}
      />

      {/* Webcam Quick Clip Modal */}
      <WebcamModal
        open={webcamOpen}
        onClose={() => setWebcamOpen(false)}
        onCaptured={(file) => {
          void loadVideoFile(file);
        }}
      />
    </div>
  );
}
