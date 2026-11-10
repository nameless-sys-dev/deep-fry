import {
  ALL_FORMATS,
  AudioBufferSource,
  BlobSource,
  BufferTarget,
  CanvasSink,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
  WebMOutputFormat,
  canEncodeAudio,
  canEncodeVideo,
  type AudioCodec,
  type VideoCodec,
} from 'mediabunny';
import {
  computeTargetDimensions,
  ExportProgress,
  ExportResult,
  FrySettings,
  VideoMetadata,
} from '../types/fry';
import { processAudioBufferOffline, sampleEnvelopeAtTime } from './audioFryer';
import { JpegCruncher } from './jpegCrunch';
import { WebGLFryer } from './webglFryer';

export function isWebCodecsSupported(): boolean {
  return typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined';
}

export async function inspectVideoFile(file: File): Promise<VideoMetadata> {
  let input: Input | null = null;
  try {
    input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(file),
    });

    const videoTrack = await input.getPrimaryVideoTrack();
    const audioTrack = await input.getPrimaryAudioTrack();
    const duration = await input.computeDuration();

    if (videoTrack) {
      const width = videoTrack.displayWidth || (await videoTrack.getCodedWidth());
      const height = videoTrack.displayHeight || (await videoTrack.getCodedHeight());
      const codec = await videoTrack.getCodec();
      let fps = 30;
      try {
        const stats = await videoTrack.computePacketStats(120);
        if (stats.averagePacketRate > 0 && Number.isFinite(stats.averagePacketRate)) {
          fps = Math.min(120, Math.max(1, Math.round(stats.averagePacketRate * 10) / 10));
        }
      } catch {
        fps = 30;
      }

      return {
        name: file.name,
        sizeBytes: file.size,
        width: width || 640,
        height: height || 480,
        duration: Number.isFinite(duration) && duration > 0 ? duration : 5,
        fps,
        hasAudio: Boolean(audioTrack),
        codecLabel: codec ? codec.toUpperCase() : 'VIDEO',
      };
    }
  } catch {
    // Fallback to <video> element probing below
  } finally {
    input?.dispose();
  }

  // HTMLVideoElement metadata fallback
  return new Promise<VideoMetadata>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const vid = document.createElement('video');
    vid.preload = 'metadata';
    vid.muted = true;
    vid.playsInline = true;
    vid.onloadedmetadata = () => {
      const meta: VideoMetadata = {
        name: file.name,
        sizeBytes: file.size,
        width: vid.videoWidth || 640,
        height: vid.videoHeight || 480,
        duration: Number.isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 5,
        fps: 30,
        hasAudio: true,
        codecLabel: 'MEDIA',
      };
      URL.revokeObjectURL(url);
      resolve(meta);
    };
    vid.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read video metadata. Try another MP4, WebM, or MOV file.'));
    };
    vid.src = url;
  });
}

async function selectVideoEncoderConfig(
  container: 'mp4' | 'webm',
  width: number,
  height: number,
  fps: number,
  settings: FrySettings
): Promise<{ codec: VideoCodec; quality: Quality }> {
  const candidates: VideoCodec[] =
    container === 'mp4' ? ['avc', 'vp9', 'av1', 'hevc'] : ['vp8', 'vp9', 'av1'];
  const targetBps = Math.max(10_000, Math.round(settings.videoBitrateKbps * 1000));

  for (const codec of candidates) {
    // Build quantizer + bitrate quality when quantizer crunch is requested & supported by codec
    const qualityAttempts: Quality[] = [];

    if (settings.quantizerCrunch > 15 && codec !== 'vp8') {
      const t = settings.quantizerCrunch / 100;
      if (codec === 'avc' || codec === 'hevc') {
        const qp = Math.min(51, Math.max(24, Math.round(24 + t * 27)));
        qualityAttempts.push(new Quality({ quantizer: qp, bitrate: targetBps, bitrateMode: 'constant' }));
        qualityAttempts.push(new Quality({ quantizer: qp, bitrate: targetBps }));
      } else {
        // Use qualitative negative-leaning scale for VP9/AV1 (Mediabunny clamps smoothly across Chrome versions!)
        qualityAttempts.push(new Quality({ quality: Math.max(-0.4, 0.35 - t * 0.75), preferBitrate: false }));
      }
    }

    qualityAttempts.push(new Quality({ bitrate: targetBps, bitrateMode: 'constant' }));
    qualityAttempts.push(new Quality({ bitrate: targetBps, bitrateMode: 'variable' }));
    qualityAttempts.push(new Quality('very-low'));

    for (const q of qualityAttempts) {
      try {
        const ok = await canEncodeVideo(codec, {
          width,
          height,
          frameRate: fps,
          quality: q,
        });
        if (ok) {
          return { codec, quality: q };
        }
      } catch {
        // Try next quality/codec candidate
      }
    }
  }

  throw new Error(
    'No hardware or WebCodecs video encoder is available for this container in your browser.'
  );
}

async function selectAudioEncoderConfig(
  container: 'mp4' | 'webm',
  numberOfChannels: number,
  sampleRate: number,
  settings: FrySettings
): Promise<{ codec: AudioCodec; quality: Quality } | null> {
  const targetBps = Math.max(8_000, Math.round(settings.audioBitrateKbps * 1000));
  const candidates: AudioCodec[] =
    container === 'mp4'
      ? settings.audioBitrateKbps <= 48
        ? ['opus', 'aac', 'mp3', 'pcm-s16']
        : ['aac', 'opus', 'mp3', 'pcm-s16']
      : ['opus', 'vorbis'];

  for (const codec of candidates) {
    const bitratesToTry =
      codec === 'aac'
        ? [Math.max(64_000, targetBps), 96_000, 128_000]
        : [targetBps, Math.max(16_000, targetBps), 64_000];

    for (const br of bitratesToTry) {
      try {
        const q =
          codec === 'pcm-s16'
            ? undefined
            : new Quality({ bitrate: br });
        const ok = await canEncodeAudio(codec, {
          numberOfChannels,
          sampleRate,
          quality: q,
        });
        if (ok) {
          return { codec, quality: q ?? new Quality('low') };
        }
      } catch {
        // Try next candidate
      }
    }
  }
  return null;
}

export interface ExportOptions {
  file: File;
  metadata: VideoMetadata;
  audioBuffer: AudioBuffer | null;
  envelope60Hz: Float32Array;
  settings: FrySettings;
  trimStart: number;
  trimEnd: number;
  signal?: AbortSignal;
  onProgress?: (p: ExportProgress) => void;
}

export async function exportDeepFriedVideo(opts: ExportOptions): Promise<ExportResult> {
  const startTime = performance.now();
  const {
    file,
    metadata,
    audioBuffer,
    envelope60Hz,
    settings,
    trimStart,
    trimEnd,
    signal,
    onProgress,
  } = opts;

  if (isWebCodecsSupported()) {
    try {
      return await exportWithWebCodecs(
        file,
        metadata,
        audioBuffer,
        envelope60Hz,
        settings,
        trimStart,
        trimEnd,
        startTime,
        signal,
        onProgress
      );
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        throw err;
      }
      console.warn('WebCodecs export failed, falling back to MediaRecorder:', err);
    }
  }

  return exportWithMediaRecorder(
    file,
    metadata,
    audioBuffer,
    envelope60Hz,
    settings,
    trimStart,
    trimEnd,
    startTime,
    signal,
    onProgress
  );
}

async function exportWithWebCodecs(
  file: File,
  metadata: VideoMetadata,
  audioBuffer: AudioBuffer | null,
  envelope60Hz: Float32Array,
  settings: FrySettings,
  trimStart: number,
  trimEnd: number,
  startTimeMs: number,
  signal?: AbortSignal,
  onProgress?: (p: ExportProgress) => void
): Promise<ExportResult> {
  const throwIfAborted = () => {
    if (signal?.aborted) {
      throw new DOMException('Export canceled by user', 'AbortError');
    }
  };

  throwIfAborted();
  onProgress?.({
    phase: 'preparing',
    progress: 0.02,
    currentFrame: 0,
    totalFrames: 1,
    elapsedSec: 0,
    realtimeFactor: 0,
    engine: 'webcodecs',
  });

  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(file),
  });

  const fryer = new WebGLFryer();
  const jpegCruncher = new JpegCruncher();

  try {
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack || !(await videoTrack.canDecode())) {
      throw new Error('Video track cannot be decoded by WebCodecs');
    }

    const srcW = videoTrack.displayWidth || metadata.width;
    const srcH = videoTrack.displayHeight || metadata.height;
    const { width: outW, height: outH } = computeTargetDimensions(srcW, srcH, settings.scalePercent);

    const effectiveFps =
      settings.fps > 0
        ? settings.fps
        : Math.min(60, Math.max(6, Math.round(metadata.fps || 30)));
    const safeTrimStart = Math.max(0, trimStart);
    const safeTrimEnd = Math.max(safeTrimStart + 0.25, Math.min(metadata.duration, trimEnd));
    const inputSpan = safeTrimEnd - safeTrimStart;
    const speed = Math.max(0.5, Math.min(2.5, settings.playbackSpeed));
    const outDuration = inputSpan / speed;
    const totalFrames = Math.max(1, Math.round(outDuration * effectiveFps));

    const firstVideoTs = await videoTrack.getFirstTimestamp().catch(() => 0);

    // Pre-build output container & sources
    const outputFormat =
      settings.container === 'mp4'
        ? new Mp4OutputFormat({ fastStart: 'in-memory' })
        : new WebMOutputFormat();

    const target = new BufferTarget();
    const output = new Output({
      format: outputFormat,
      target,
    });

    const videoCodecConfig = await selectVideoEncoderConfig(
      settings.container,
      outW,
      outH,
      effectiveFps,
      settings
    );

    const videoSource = new CanvasSource(fryer.outputCanvas, {
      codec: videoCodecConfig.codec,
      quality: videoCodecConfig.quality,
      keyFrameInterval: settings.keyFrameIntervalSec,
    });
    output.addVideoTrack(videoSource, { frameRate: effectiveFps });

    // Process audio offline in <50ms if enabled and present
    let processedAudio: AudioBuffer | null = null;
    let audioCodecLabel: string | null = null;
    let audioSource: AudioBufferSource | null = null;

    if (settings.includeAudio && audioBuffer) {
      throwIfAborted();
      onProgress?.({
        phase: 'audio',
        progress: 0.08,
        currentFrame: 0,
        totalFrames,
        elapsedSec: (performance.now() - startTimeMs) / 1000,
        realtimeFactor: 0,
        engine: 'webcodecs',
      });

      processedAudio = await processAudioBufferOffline(
        audioBuffer,
        settings,
        safeTrimStart,
        safeTrimEnd
      );

      const audioCodecConfig = await selectAudioEncoderConfig(
        settings.container,
        processedAudio.numberOfChannels,
        processedAudio.sampleRate,
        settings
      );

      if (audioCodecConfig) {
        audioCodecLabel = audioCodecConfig.codec.toUpperCase();
        audioSource = new AudioBufferSource({
          codec: audioCodecConfig.codec,
          quality: audioCodecConfig.quality,
        });
        output.addAudioTrack(audioSource);
      }
    }

    await output.start();

    const frameTimes: number[] = new Array(totalFrames);
    const frameDur = 1 / effectiveFps;
    for (let i = 0; i < totalFrames; i++) {
      const tIn = safeTrimStart + i * frameDur * speed;
      frameTimes[i] = Math.max(firstVideoTs, Math.min(safeTrimEnd - 0.002, tIn));
    }

    const canvasSink = new CanvasSink(videoTrack, {
      width: outW,
      height: outH,
      fit: 'fill',
      poolSize: 1,
    });

    const encodeVideoFrames = async () => {
      let frameIdx = 0;
      type FrameTexSource = TexImageSource & CanvasImageSource;
      let lastValidSource: FrameTexSource | null = null;

      for await (const wrapped of canvasSink.canvasesAtTimestamps(frameTimes)) {
        throwIfAborted();

        const tIn = frameTimes[frameIdx] ?? safeTrimStart;
        const outTs = frameIdx * frameDur;
        const bassLevel = sampleEnvelopeAtTime(envelope60Hz, tIn);

        const wrappedCanvas = wrapped?.canvas as FrameTexSource | undefined;
        const srcCanvas: FrameTexSource | null = wrappedCanvas ?? lastValidSource;
        if (srcCanvas) {
          lastValidSource = srcCanvas;

          // 1. Compose staging canvas (scaling filter + Impact text + lens flare + emoji stamps)
          const staged = fryer.composeStaging(
            srcCanvas,
            outW,
            outH,
            settings,
            tIn,
            bassLevel
          );

          // 2. Run WebGL2 GPU Deep-Fry Shader
          fryer.renderFrame({
            friedInput: staged as TexImageSource & CanvasImageSource,
            outputWidth: outW,
            outputHeight: outH,
            targetResWidth: outW,
            targetResHeight: outH,
            settings,
            timeSec: tIn,
            bassLevel,
            splitPos: 0,
            bypass: false,
          });

          // 3. Optional real multi-pass JPEG re-fry crunch!
          if (settings.jpegPasses > 0) {
            const crunched = await jpegCruncher.crunch(
              fryer.outputCanvas,
              outW,
              outH,
              settings.jpegPasses,
              settings.jpegQuality
            );
            // Blit crunched JPEG back to fryer canvas via clean passthrough
            fryer.renderFrame({
              friedInput: crunched as TexImageSource & CanvasImageSource,
              rawInput: crunched as TexImageSource & CanvasImageSource,
              outputWidth: outW,
              outputHeight: outH,
              targetResWidth: outW,
              targetResHeight: outH,
              settings,
              timeSec: tIn,
              bassLevel: 0,
              splitPos: 0,
              bypass: true, // Passthrough crunched JPEG buffer directly to outputCanvas
            });
          }

          await videoSource.add(outTs, frameDur);
        }

        frameIdx++;
        const elapsed = Math.max(0.01, (performance.now() - startTimeMs) / 1000);
        const processedVideoSec = frameIdx * frameDur;
        onProgress?.({
          phase: 'frames',
          progress: 0.1 + 0.85 * (frameIdx / totalFrames),
          currentFrame: frameIdx,
          totalFrames,
          elapsedSec: elapsed,
          realtimeFactor: processedVideoSec / elapsed,
          engine: 'webcodecs',
        });
      }

      videoSource.close();
    };

    const encodeAudioTrack = async () => {
      if (audioSource && processedAudio) {
        await audioSource.add(processedAudio);
        audioSource.close();
      }
    };

    try {
      await Promise.all([encodeVideoFrames(), encodeAudioTrack()]);
    } catch (err) {
      await output.cancel().catch(() => {});
      throw err;
    }

    throwIfAborted();
    onProgress?.({
      phase: 'finalizing',
      progress: 0.97,
      currentFrame: totalFrames,
      totalFrames,
      elapsedSec: (performance.now() - startTimeMs) / 1000,
      realtimeFactor: outDuration / Math.max(0.01, (performance.now() - startTimeMs) / 1000),
      engine: 'webcodecs',
    });

    await output.finalize();

    const buffer = target.buffer;
    if (!buffer) {
      throw new Error('Muxer returned an empty buffer.');
    }

    const ext = settings.container === 'mp4' ? 'mp4' : 'webm';
    const mimeType = settings.container === 'mp4' ? 'video/mp4' : 'video/webm';
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const fileName = `${baseName}_DEEPFRIED.${ext}`;

    const blob = new Blob([buffer], { type: mimeType });
    const outFile = new File([blob], fileName, { type: mimeType });
    const url = URL.createObjectURL(blob);
    const encodeTimeSec = (performance.now() - startTimeMs) / 1000;

    return {
      blob,
      file: outFile,
      url,
      fileName,
      originalSize: file.size,
      outputSize: blob.size,
      outputWidth: outW,
      outputHeight: outH,
      outputDuration: outDuration,
      encodeTimeSec,
      realtimeFactor: outDuration / Math.max(0.01, encodeTimeSec),
      videoCodec: videoCodecConfig.codec.toUpperCase(),
      audioCodec: audioCodecLabel,
      engine: 'webcodecs',
    };
  } finally {
    fryer.dispose();
    input.dispose();
  }
}

/**
 * Fallback export path for browsers without WebCodecs VideoEncoder.
 * Captures the WebGL2 fryer canvas + offline-fried AudioBuffer in MediaRecorder.
 */
async function exportWithMediaRecorder(
  file: File,
  metadata: VideoMetadata,
  audioBuffer: AudioBuffer | null,
  envelope60Hz: Float32Array,
  settings: FrySettings,
  trimStart: number,
  trimEnd: number,
  startTimeMs: number,
  signal?: AbortSignal,
  onProgress?: (p: ExportProgress) => void
): Promise<ExportResult> {
  const srcUrl = URL.createObjectURL(file);
  const videoEl = document.createElement('video');
  videoEl.src = srcUrl;
  videoEl.muted = true;
  videoEl.playsInline = true;
  videoEl.crossOrigin = 'anonymous';

  const displayCanvas = document.createElement('canvas');
  const fryer = new WebGLFryer(displayCanvas);
  const jpegCruncher = new JpegCruncher();

  try {
    await new Promise<void>((resolve, reject) => {
      videoEl.onloadeddata = () => resolve();
      videoEl.onerror = () => reject(new Error('Failed to load video for fallback export'));
    });

    const { width: outW, height: outH } = computeTargetDimensions(
      videoEl.videoWidth || metadata.width,
      videoEl.videoHeight || metadata.height,
      settings.scalePercent
    );
    displayCanvas.width = outW;
    displayCanvas.height = outH;

    const effectiveFps = settings.fps > 0 ? settings.fps : 24;
    const safeTrimStart = Math.max(0, trimStart);
    const safeTrimEnd = Math.max(safeTrimStart + 0.25, Math.min(metadata.duration, trimEnd));
    const speed = Math.max(0.5, Math.min(2.5, settings.playbackSpeed));
    const outDuration = (safeTrimEnd - safeTrimStart) / speed;
    const totalFrames = Math.max(1, Math.round(outDuration * effectiveFps));

    const stream = displayCanvas.captureStream(effectiveFps);
    let audioCtx: AudioContext | null = null;
    let bufferSrc: AudioBufferSourceNode | null = null;

    if (settings.includeAudio && audioBuffer) {
      const processed = await processAudioBufferOffline(
        audioBuffer,
        settings,
        safeTrimStart,
        safeTrimEnd
      );
      audioCtx = new AudioContext({ sampleRate: processed.sampleRate });
      const dest = audioCtx.createMediaStreamDestination();
      bufferSrc = audioCtx.createBufferSource();
      bufferSrc.buffer = processed;
      bufferSrc.connect(dest);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    }

    const preferredMimes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
    ];
    const mimeType = preferredMimes.find((m) => MediaRecorder.isTypeSupported(m)) || '';

    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: Math.max(15_000, settings.videoBitrateKbps * 1000),
      audioBitsPerSecond: Math.max(8_000, settings.audioBitrateKbps * 1000),
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const donePromise = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType || 'video/webm' }));
      recorder.onerror = () => reject(new Error('MediaRecorder encoding failed'));
    });

    videoEl.currentTime = safeTrimStart;
    await new Promise<void>((r) => {
      videoEl.onseeked = () => r();
    });

    videoEl.playbackRate = speed;
    recorder.start(250);
    bufferSrc?.start(0);
    await videoEl.play();

    let frameTimer = 0;
    const frameIntervalMs = 1000 / effectiveFps;
    let lastDraw = 0;

    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        cancelAnimationFrame(frameTimer);
        recorder.stop();
        reject(new DOMException('Export canceled by user', 'AbortError'));
      };
      signal?.addEventListener('abort', onAbort, { once: true });

      const tick = async (now: number) => {
        if (signal?.aborted) return;
        if (videoEl.currentTime >= safeTrimEnd || videoEl.ended) {
          signal?.removeEventListener('abort', onAbort);
          resolve();
          return;
        }
        if (now - lastDraw >= frameIntervalMs) {
          lastDraw = now;
          const tIn = videoEl.currentTime;
          const bassLevel = sampleEnvelopeAtTime(envelope60Hz, tIn);
          const staged = fryer.composeStaging(videoEl, outW, outH, settings, tIn, bassLevel);
          fryer.renderFrame({
            friedInput: staged as TexImageSource & CanvasImageSource,
            outputWidth: outW,
            outputHeight: outH,
            targetResWidth: outW,
            targetResHeight: outH,
            settings,
            timeSec: tIn,
            bassLevel,
          });
          if (settings.jpegPasses > 0) {
            const crunched = await jpegCruncher.crunch(
              fryer.outputCanvas,
              outW,
              outH,
              1,
              settings.jpegQuality
            );
            fryer.renderFrame({
              friedInput: crunched as TexImageSource & CanvasImageSource,
              rawInput: crunched as TexImageSource & CanvasImageSource,
              outputWidth: outW,
              outputHeight: outH,
              targetResWidth: outW,
              targetResHeight: outH,
              settings,
              timeSec: tIn,
              bassLevel: 0,
              bypass: true,
            });
          }

          const pct = Math.min(0.95, Math.max(0, (tIn - safeTrimStart) / (safeTrimEnd - safeTrimStart)));
          const elapsed = Math.max(0.01, (performance.now() - startTimeMs) / 1000);
          onProgress?.({
            phase: 'frames',
            progress: pct,
            currentFrame: Math.round(pct * totalFrames),
            totalFrames,
            elapsedSec: elapsed,
            realtimeFactor: (tIn - safeTrimStart) / speed / elapsed,
            engine: 'mediarecorder',
          });
        }
        frameTimer = requestAnimationFrame(tick);
      };
      frameTimer = requestAnimationFrame(tick);
    });

    videoEl.pause();
    bufferSrc?.stop();
    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
    const blob = await donePromise;
    await audioCtx?.close().catch(() => {});

    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const fileName = `${baseName}_DEEPFRIED.${ext}`;
    const outFile = new File([blob], fileName, { type: blob.type });
    const encodeTimeSec = (performance.now() - startTimeMs) / 1000;

    return {
      blob,
      file: outFile,
      url: URL.createObjectURL(blob),
      fileName,
      originalSize: file.size,
      outputSize: blob.size,
      outputWidth: outW,
      outputHeight: outH,
      outputDuration: outDuration,
      encodeTimeSec,
      realtimeFactor: outDuration / Math.max(0.01, encodeTimeSec),
      videoCodec: ext.toUpperCase(),
      audioCodec: settings.includeAudio && audioBuffer ? 'OPUS' : null,
      engine: 'mediarecorder',
    };
  } finally {
    fryer.dispose();
    URL.revokeObjectURL(srcUrl);
  }
}
