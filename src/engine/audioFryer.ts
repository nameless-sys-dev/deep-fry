import { ALL_FORMATS, AudioBufferSink, BlobSource, Input } from 'mediabunny';
import { FrySettings } from '../types/fry';

let sharedAudioCtx: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext {
  if (!sharedAudioCtx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
}

/**
 * Decodes audio from an uploaded or generated video File.
 * Uses native decodeAudioData first for blazing speed, falling back to Mediabunny AudioBufferSink.
 */
export async function decodeAudioFromFile(file: File): Promise<AudioBuffer | null> {
  const ctx = getSharedAudioContext();

  try {
    const arrayBuffer = await file.arrayBuffer();
    // decodeAudioData detaches/consumes buffer in some browsers, so pass slice only if needed
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    if (decoded && decoded.length > 0) {
      return decoded;
    }
  } catch {
    // Fallback below: file might have no audio track, or codec like WebM/Opus on Safari
  }

  let input: Input | null = null;
  try {
    input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(file),
    });
    const audioTrack = await input.getPrimaryAudioTrack();
    if (!audioTrack) {
      return null;
    }
    const canDecode = await audioTrack.canDecode();
    if (!canDecode) {
      return null;
    }

    const sink = new AudioBufferSink(audioTrack);
    const chunks: AudioBuffer[] = [];
    let totalFrames = 0;
    let sampleRate = 48000;
    let channels = 2;

    for await (const wrapped of sink.buffers()) {
      const buf = wrapped.buffer;
      if (chunks.length === 0) {
        sampleRate = buf.sampleRate;
        channels = buf.numberOfChannels;
      }
      chunks.push(buf);
      totalFrames += buf.length;
    }

    if (chunks.length === 0 || totalFrames === 0) {
      return null;
    }

    const merged = ctx.createBuffer(channels, totalFrames, sampleRate);
    let offset = 0;
    for (const chunk of chunks) {
      for (let ch = 0; ch < channels; ch++) {
        const srcCh = Math.min(ch, chunk.numberOfChannels - 1);
        merged.getChannelData(ch).set(chunk.getChannelData(srcCh), offset);
      }
      offset += chunk.length;
    }
    return merged;
  } catch {
    return null;
  } finally {
    input?.dispose();
  }
}

export interface AudioAnalysis {
  waveform: Float32Array;
  envelope60Hz: Float32Array;
}

/**
 * Extracts normalized visual waveform bars and a 60Hz RMS energy envelope for deterministic audio-reactive shake.
 */
export function extractWaveformAndEnvelope(
  buffer: AudioBuffer | null,
  waveformBins = 160,
  envelopeHz = 60
): AudioAnalysis {
  if (!buffer || buffer.length === 0) {
    return {
      waveform: new Float32Array(waveformBins),
      envelope60Hz: new Float32Array(1),
    };
  }

  const ch0 = buffer.getChannelData(0);
  const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
  const totalSamples = buffer.length;

  // Visual waveform peak bins
  const waveform = new Float32Array(waveformBins);
  const samplesPerBin = Math.max(1, Math.floor(totalSamples / waveformBins));
  let maxPeak = 0.0001;
  for (let b = 0; b < waveformBins; b++) {
    const start = b * samplesPerBin;
    const end = Math.min(totalSamples, start + samplesPerBin);
    const step = Math.max(1, Math.floor((end - start) / 64));
    let peak = 0;
    for (let i = start; i < end; i += step) {
      const v = ch1 ? Math.max(Math.abs(ch0[i]), Math.abs(ch1[i])) : Math.abs(ch0[i]);
      if (v > peak) peak = v;
    }
    waveform[b] = peak;
    if (peak > maxPeak) maxPeak = peak;
  }
  for (let b = 0; b < waveformBins; b++) {
    waveform[b] /= maxPeak;
  }

  // 60Hz RMS envelope
  const envLen = Math.max(1, Math.ceil(buffer.duration * envelopeHz));
  const envelope60Hz = new Float32Array(envLen);
  const envWindow = Math.max(1, Math.floor(buffer.sampleRate / envelopeHz));
  let maxRms = 0.0001;

  for (let e = 0; e < envLen; e++) {
    const start = e * envWindow;
    const end = Math.min(totalSamples, start + envWindow);
    const step = Math.max(1, Math.floor((end - start) / 48));
    let sumSq = 0;
    let count = 0;
    for (let i = start; i < end; i += step) {
      const v = ch1 ? (ch0[i] + ch1[i]) * 0.5 : ch0[i];
      sumSq += v * v;
      count++;
    }
    const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
    envelope60Hz[e] = rms;
    if (rms > maxRms) maxRms = rms;
  }

  // Normalize + apply knee curve so loud peaks punch harder
  for (let e = 0; e < envLen; e++) {
    const norm = Math.min(1, envelope60Hz[e] / maxRms);
    envelope60Hz[e] = Math.pow(norm, 1.35);
  }

  return { waveform, envelope60Hz };
}

export function sampleEnvelopeAtTime(envelope: Float32Array, timeSec: number, envelopeHz = 60): number {
  if (envelope.length <= 1) return 0;
  const idx = Math.max(0, Math.min(envelope.length - 1, Math.floor(timeSec * envelopeHz)));
  return envelope[idx] ?? 0;
}

/**
 * Generates an asymmetric + hard-clipping distortion waveshaper curve.
 */
function makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 2048;
  const buffer = new ArrayBuffer(n * 4);
  const curve = new Float32Array(buffer);
  const k = 1 + amount * 85;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    // Blend soft saturation with harsh asymmetric clip for authentic fried crunch
    const soft = Math.tanh(x * k);
    const hard = Math.max(-0.92, Math.min(0.92, x * (1 + amount * 14)));
    curve[i] = soft * (1 - amount * 0.45) + hard * (amount * 0.45);
  }
  return curve;
}

/**
 * Trims, time-stretches (via resampling), and deep-fries an AudioBuffer completely offline in <50ms.
 */
export async function processAudioBufferOffline(
  source: AudioBuffer,
  settings: FrySettings,
  trimStart: number,
  trimEnd: number
): Promise<AudioBuffer> {
  const sr = source.sampleRate;
  const targetSr = 48000;
  const channels = Math.min(2, Math.max(1, source.numberOfChannels));
  const startSample = Math.max(0, Math.min(source.length - 1, Math.floor(trimStart * sr)));
  const endSample = Math.max(startSample + 1, Math.min(source.length, Math.ceil(trimEnd * sr)));
  const trimmedLen = Math.max(256, endSample - startSample);

  const speed = Math.max(0.5, Math.min(2.5, settings.playbackSpeed));
  const speedLen = Math.max(256, Math.round(trimmedLen / speed));
  const targetLen48k = Math.max(256, Math.round((speedLen / sr) * targetSr));

  // Build trimmed & speed-resampled buffer at source sampleRate, then let OfflineAudioContext resample to 48kHz
  const offlineCtx = new OfflineAudioContext(channels, targetLen48k, targetSr);
  const workBuffer = offlineCtx.createBuffer(channels, speedLen, sr);

  for (let ch = 0; ch < channels; ch++) {
    const srcData = source.getChannelData(Math.min(ch, source.numberOfChannels - 1));
    const dstData = workBuffer.getChannelData(ch);
    if (Math.abs(speed - 1.0) < 0.001) {
      const copyEnd = Math.min(source.length, startSample + speedLen);
      dstData.set(srcData.subarray(startSample, copyEnd));
    } else {
      for (let i = 0; i < speedLen; i++) {
        const pos = startSample + i * speed;
        const i0 = Math.min(source.length - 1, Math.floor(pos));
        const i1 = Math.min(source.length - 1, i0 + 1);
        const frac = pos - i0;
        dstData[i] = srcData[i0] * (1 - frac) + srcData[i1] * frac;
      }
    }
  }

  if (!settings.audioFryEnabled) {
    if (sr === targetSr) {
      return workBuffer;
    }
    const passthru = offlineCtx.createBufferSource();
    passthru.buffer = workBuffer;
    passthru.connect(offlineCtx.destination);
    passthru.start(0);
    return offlineCtx.startRendering();
  }

  // Stage 1: Web Audio Offline filter chain (Bass boost + Potato Mic EQ + Slapback Echo)
  const bufferSrc = offlineCtx.createBufferSource();
  bufferSrc.buffer = workBuffer;

  let head: AudioNode = bufferSrc;

  if (settings.bassBoostDb > 0.2) {
    const bassFilter = offlineCtx.createBiquadFilter();
    bassFilter.type = 'lowshelf';
    bassFilter.frequency.value = 95;
    bassFilter.gain.value = settings.bassBoostDb;
    head.connect(bassFilter);
    head = bassFilter;
  }

  if (settings.potatoMic > 0.02) {
    const hp = offlineCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 120 + settings.potatoMic * 380;
    const lp = offlineCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 8000 - settings.potatoMic * 5600;
    const nasal = offlineCtx.createBiquadFilter();
    nasal.type = 'peaking';
    nasal.frequency.value = 1250;
    nasal.Q.value = 1.8;
    nasal.gain.value = settings.potatoMic * 11;

    head.connect(hp);
    hp.connect(lp);
    lp.connect(nasal);
    head = nasal;
  }

  if (settings.echoChaos > 0.02) {
    const dry = offlineCtx.createGain();
    dry.gain.value = 1.0;
    const delay = offlineCtx.createDelay(0.5);
    delay.delayTime.value = 0.038 + settings.echoChaos * 0.035;
    const fb = offlineCtx.createGain();
    fb.gain.value = Math.min(0.72, 0.2 + settings.echoChaos * 0.48);
    const wet = offlineCtx.createGain();
    wet.gain.value = settings.echoChaos * 0.55;
    const sum = offlineCtx.createGain();

    head.connect(dry);
    dry.connect(sum);

    head.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(sum);
    head = sum;
  }

  head.connect(offlineCtx.destination);
  bufferSrc.start(0);

  const filtered = await offlineCtx.startRendering();

  // Stage 2: Direct Float32Array DSP (Overdrive Gain + Clipping Waveshaper + Bitcrush + Safety Limiter)
  const driveGain = Math.pow(10, settings.audioGainDb / 20);
  const distAmt = settings.distortion;
  const bits = Math.max(2, Math.min(16, Math.round(settings.bitcrushBits)));
  const levels = bits < 16 ? Math.pow(2, bits - 1) : 0;
  const holdSamples = Math.max(1, Math.round(settings.sampleRateCrunch));
  const limitLinear = Math.pow(10, settings.earSafeLimitDb / 20);

  const atk = Math.exp(-1 / (0.001 * filtered.sampleRate));
  const rel = Math.exp(-1 / (0.065 * filtered.sampleRate));

  for (let ch = 0; ch < filtered.numberOfChannels; ch++) {
    const data = filtered.getChannelData(ch);
    let held = 0;
    let env = 0;

    for (let i = 0; i < data.length; i++) {
      let s = data[i] * driveGain;

      // Nonlinear crunch waveshaper + hard clip
      if (distAmt > 0.01 || driveGain > 1.2) {
        const k = 1 + distAmt * 18;
        const soft = Math.tanh(s * (1 + distAmt * 3));
        const clipped = Math.max(-0.98, Math.min(0.98, s * (1 + distAmt * 0.5) * (k * 0.12 + 1)));
        s = soft * (1 - distAmt * 0.55) + clipped * (distAmt * 0.55);
      }

      // Sample rate decimation (sample & hold)
      if (holdSamples > 1) {
        if (i % holdSamples === 0) {
          held = s;
        }
        s = held;
      }

      // Bit-depth quantization
      if (levels > 0) {
        s = Math.round(Math.max(-1, Math.min(1, s)) * levels) / levels;
      }

      // Speaker-saver lookahead/envelope limiter
      const absS = Math.abs(s);
      env = absS > env ? atk * env + (1 - atk) * absS : rel * env + (1 - rel) * absS;
      if (env > limitLinear) {
        s *= limitLinear / (env + 1e-6);
      }
      data[i] = Math.max(-limitLinear, Math.min(limitLinear, s));
    }
  }

  return filtered;
}

const BITCRUSH_WORKLET_CODE = `
class FryBitcrusherProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'bits', defaultValue: 16, minValue: 2, maxValue: 16, automationRate: 'k-rate' },
      { name: 'downsample', defaultValue: 1, minValue: 1, maxValue: 24, automationRate: 'k-rate' }
    ];
  }
  constructor() {
    super();
    this.phase = [0, 0];
    this.last = [0, 0];
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !output) return true;
    const bits = Math.round(parameters.bits[0]);
    const step = Math.max(1, Math.round(parameters.downsample[0]));
    const levels = bits < 16 ? Math.pow(2, bits - 1) : 0;

    for (let ch = 0; ch < output.length; ch++) {
      const inp = input[ch] || input[0];
      const out = output[ch];
      if (!inp) continue;
      for (let i = 0; i < out.length; i++) {
        this.phase[ch] = (this.phase[ch] || 0) + 1;
        if (this.phase[ch] >= step || step === 1) {
          this.phase[ch] = 0;
          let v = inp[i];
          if (levels > 0) {
            v = Math.round(Math.max(-1, Math.min(1, v)) * levels) / levels;
          }
          this.last[ch] = v;
        }
        out[i] = this.last[ch] || 0;
      }
    }
    return true;
  }
}
registerProcessor('fry-bitcrusher', FryBitcrusherProcessor);
`;

/**
 * Real-time Web Audio graph hooked to the preview <video> element.
 * Lets users tweak Bass Boost, Distortion, Bitcrusher, Potato Mic & Volume live with zero re-encode delay.
 */
export class LiveAudioController {
  private ctx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private attachedEl: HTMLVideoElement | null = null;

  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private preDrive: GainNode | null = null;
  private bassFilter: BiquadFilterNode | null = null;
  private hpFilter: BiquadFilterNode | null = null;
  private lpFilter: BiquadFilterNode | null = null;
  private nasalFilter: BiquadFilterNode | null = null;
  private shaper: WaveShaperNode | null = null;
  private delayNode: DelayNode | null = null;
  private echoFeedback: GainNode | null = null;
  private echoWet: GainNode | null = null;
  private crushNode: AudioWorkletNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private freqBins = new Uint8Array(64);
  private workletReady = false;
  private initializing = false;

  async attach(videoEl: HTMLVideoElement, settings: FrySettings, volume01: number, bypass: boolean) {
    if (this.attachedEl === videoEl && this.ctx) {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume().catch(() => {});
      }
      this.update(settings, volume01, bypass);
      return;
    }
    if (this.initializing || this.attachedEl) return;
    this.initializing = true;

    try {
      const ctx = getSharedAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }

      const source = ctx.createMediaElementSource(videoEl);
      const dryGain = ctx.createGain();
      const wetGain = ctx.createGain();
      const preDrive = ctx.createGain();

      const bassFilter = ctx.createBiquadFilter();
      bassFilter.type = 'lowshelf';
      bassFilter.frequency.value = 95;

      const hpFilter = ctx.createBiquadFilter();
      hpFilter.type = 'highpass';

      const lpFilter = ctx.createBiquadFilter();
      lpFilter.type = 'lowpass';

      const nasalFilter = ctx.createBiquadFilter();
      nasalFilter.type = 'peaking';
      nasalFilter.frequency.value = 1250;
      nasalFilter.Q.value = 1.8;

      const shaper = ctx.createWaveShaper();
      shaper.oversample = '2x';

      const delayNode = ctx.createDelay(0.5);
      const echoFeedback = ctx.createGain();
      const echoWet = ctx.createGain();
      const echoSum = ctx.createGain();

      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -2;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.05;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;

      const masterGain = ctx.createGain();

      // Try loading inline Blob AudioWorklet for live bitcrushing
      let crushNode: AudioWorkletNode | null = null;
      if (ctx.audioWorklet) {
        try {
          const blobUrl = URL.createObjectURL(
            new Blob([BITCRUSH_WORKLET_CODE], { type: 'application/javascript' })
          );
          await ctx.audioWorklet.addModule(blobUrl);
          URL.revokeObjectURL(blobUrl);
          crushNode = new AudioWorkletNode(ctx, 'fry-bitcrusher');
          this.workletReady = true;
        } catch {
          crushNode = null;
        }
      }

      // Dry path
      source.connect(dryGain);
      dryGain.connect(analyser);

      // Wet path
      source.connect(bassFilter);
      bassFilter.connect(hpFilter);
      hpFilter.connect(lpFilter);
      lpFilter.connect(nasalFilter);
      nasalFilter.connect(preDrive);
      preDrive.connect(shaper);

      if (crushNode) {
        shaper.connect(crushNode);
        crushNode.connect(echoSum);
        crushNode.connect(delayNode);
      } else {
        shaper.connect(echoSum);
        shaper.connect(delayNode);
      }

      delayNode.connect(echoFeedback);
      echoFeedback.connect(delayNode);
      delayNode.connect(echoWet);
      echoWet.connect(echoSum);

      echoSum.connect(wetGain);
      wetGain.connect(analyser);

      analyser.connect(limiter);
      limiter.connect(masterGain);
      masterGain.connect(ctx.destination);

      this.ctx = ctx;
      this.sourceNode = source;
      this.attachedEl = videoEl;
      this.dryGain = dryGain;
      this.wetGain = wetGain;
      this.preDrive = preDrive;
      this.bassFilter = bassFilter;
      this.hpFilter = hpFilter;
      this.lpFilter = lpFilter;
      this.nasalFilter = nasalFilter;
      this.shaper = shaper;
      this.delayNode = delayNode;
      this.echoFeedback = echoFeedback;
      this.echoWet = echoWet;
      this.crushNode = crushNode;
      this.limiter = limiter;
      this.masterGain = masterGain;
      this.analyser = analyser;
      this.freqBins = new Uint8Array(analyser.frequencyBinCount);

      this.update(settings, volume01, bypass);
    } catch (err) {
      console.warn('LiveAudioController attach skipped:', err);
    } finally {
      this.initializing = false;
    }
  }

  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume().catch(() => {});
    }
  }

  update(settings: FrySettings, volume01: number, bypass: boolean) {
    if (!this.ctx || !this.masterGain || !this.dryGain || !this.wetGain) return;
    const now = this.ctx.currentTime;

    if (!settings.includeAudio) {
      this.masterGain.gain.setTargetAtTime(0, now, 0.015);
      return;
    }

    const useWet = settings.audioFryEnabled && !bypass;
    this.dryGain.gain.setTargetAtTime(useWet ? 0 : 1, now, 0.015);
    this.wetGain.gain.setTargetAtTime(useWet ? 1 : 0, now, 0.015);

    const safeCeiling = Math.pow(10, settings.earSafeLimitDb / 20);
    this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, volume01)) * safeCeiling, now, 0.015);

    if (this.limiter) {
      this.limiter.threshold.setTargetAtTime(settings.earSafeLimitDb, now, 0.02);
    }

    if (this.bassFilter) {
      this.bassFilter.gain.setTargetAtTime(settings.bassBoostDb, now, 0.02);
    }

    if (this.hpFilter && this.lpFilter && this.nasalFilter) {
      this.hpFilter.frequency.setTargetAtTime(
        settings.potatoMic > 0.02 ? 120 + settings.potatoMic * 380 : 20,
        now,
        0.02
      );
      this.lpFilter.frequency.setTargetAtTime(
        settings.potatoMic > 0.02 ? 8000 - settings.potatoMic * 5600 : 20000,
        now,
        0.02
      );
      this.nasalFilter.gain.setTargetAtTime(settings.potatoMic * 11, now, 0.02);
    }

    if (this.preDrive) {
      const drive = Math.min(18, Math.pow(10, settings.audioGainDb / 20));
      this.preDrive.gain.setTargetAtTime(drive, now, 0.02);
    }

    if (this.shaper) {
      this.shaper.curve = makeDistortionCurve(settings.distortion);
    }

    if (this.delayNode && this.echoFeedback && this.echoWet) {
      this.delayNode.delayTime.setTargetAtTime(0.038 + settings.echoChaos * 0.035, now, 0.02);
      this.echoFeedback.gain.setTargetAtTime(
        settings.echoChaos > 0.02 ? Math.min(0.7, 0.2 + settings.echoChaos * 0.45) : 0,
        now,
        0.02
      );
      this.echoWet.gain.setTargetAtTime(settings.echoChaos * 0.55, now, 0.02);
    }

    if (this.crushNode && this.workletReady) {
      const bitsParam = this.crushNode.parameters.get('bits');
      const dsParam = this.crushNode.parameters.get('downsample');
      bitsParam?.setValueAtTime(Math.round(settings.bitcrushBits), now);
      dsParam?.setValueAtTime(Math.round(settings.sampleRateCrunch), now);
    }
  }

  getLiveBassLevel(): number {
    if (!this.analyser) return 0;
    this.analyser.getByteFrequencyData(this.freqBins);
    let sum = 0;
    const count = Math.min(10, this.freqBins.length);
    for (let i = 0; i < count; i++) {
      sum += this.freqBins[i];
    }
    return count > 0 ? Math.pow(sum / (count * 255), 1.2) : 0;
  }

  dispose() {
    this.sourceNode?.disconnect();
    this.masterGain?.disconnect();
  }
}
