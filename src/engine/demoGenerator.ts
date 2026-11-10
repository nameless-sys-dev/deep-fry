import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  Quality,
  WebMOutputFormat,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
} from 'mediabunny';

export interface DemoClipMeta {
  id: 'bouncing-chaos' | 'retro-prism' | 'dvd-corner';
  title: string;
  subtitle: string;
  durationLabel: string;
}

export const DEMO_CLIPS: DemoClipMeta[] = [
  {
    id: 'bouncing-chaos',
    title: 'Emoji Bounce',
    subtitle: '808 bass drops + bouncing 🗿💀🔥',
    durationLabel: '4.5s',
  },
  {
    id: 'retro-prism',
    title: 'Neon Hypercube',
    subtitle: '3D wireframe + synthwave arp',
    durationLabel: '4.5s',
  },
  {
    id: 'dvd-corner',
    title: 'Corner Hit',
    subtitle: 'DVD bounce + cowbell bass hit',
    durationLabel: '4.5s',
  },
];

function synthesizeDemoAudio(
  clipId: DemoClipMeta['id'],
  durationSec: number,
  sampleRate = 48000
): AudioBuffer {
  const numSamples = Math.round(durationSec * sampleRate);
  const OfflineCtx =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  const ctx = new OfflineCtx(2, numSamples, sampleRate);
  const buffer = ctx.createBuffer(2, numSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  const beatDur = 0.5; // 120 BPM
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const beatTime = t % beatDur;
    const beatIndex = Math.floor(t / beatDur);

    let sampleL = 0;
    let sampleR = 0;

    if (clipId === 'bouncing-chaos') {
      // Heavy 808 kick + boom on every beat
      const pitch = 155 * Math.exp(-beatTime * 18) + 46;
      const env = Math.exp(-beatTime * 5.2);
      const kick = Math.sin(2 * Math.PI * pitch * beatTime) * env * 0.65;

      // Brass/meme chord stabs on beats 0, 3, 5, 7
      let chord = 0;
      if (beatIndex % 2 === 0 || beatIndex === 7) {
        const chordEnv = Math.exp(-beatTime * 6.5);
        const freqs = beatIndex % 4 === 0 ? [220, 277.18, 329.63] : [196, 246.94, 293.66];
        for (const f of freqs) {
          chord += Math.sin(2 * Math.PI * f * t) * 0.14;
          chord += Math.sin(2 * Math.PI * f * 2 * t) * 0.06;
        }
        chord *= chordEnv;
      }

      // Crispy hi-hat offbeat
      const offT = (t + beatDur * 0.5) % beatDur;
      const hat = (Math.random() * 2 - 1) * Math.exp(-offT * 42) * 0.15;

      sampleL = kick + chord + hat;
      sampleR = kick + chord * 0.92 - hat * 0.8;
    } else if (clipId === 'retro-prism') {
      // Synthwave arpeggio + sub pulse
      const notes = [110, 130.81, 164.81, 196, 220, 196, 164.81, 130.81];
      const step = Math.floor(t / 0.125);
      const stepT = t % 0.125;
      const f = notes[step % notes.length];
      const arpEnv = Math.exp(-stepT * 12);
      const saw = ((t * f) % 1) * 2 - 1;
      const arp = saw * arpEnv * 0.25;

      const kickEnv = Math.exp(-beatTime * 8);
      const kick = Math.sin(2 * Math.PI * (140 * Math.exp(-beatTime * 22) + 48) * beatTime) * kickEnv * 0.6;

      sampleL = kick + arp;
      sampleR = kick + arp * 0.85;
    } else {
      // Phonk-style cowbell melody + corner hit explosion at t=3.0s
      const step = Math.floor(t / 0.25);
      const stepT = t % 0.25;
      const bellNotes = [523.25, 622.25, 698.46, 523.25, 783.99, 698.46, 622.25, 466.16];
      const bf = bellNotes[step % bellNotes.length];
      const bell =
        (Math.sin(2 * Math.PI * bf * t) + 0.6 * Math.sin(2 * Math.PI * bf * 1.48 * t)) *
        Math.exp(-stepT * 14) *
        0.24;

      const kickEnv = Math.exp(-beatTime * 6.5);
      const kick = Math.sin(2 * Math.PI * (160 * Math.exp(-beatTime * 20) + 45) * beatTime) * kickEnv * 0.62;

      let boom = 0;
      if (t >= 3.0) {
        const bt = t - 3.0;
        boom =
          Math.sin(2 * Math.PI * (180 * Math.exp(-bt * 6) + 38) * bt) * Math.exp(-bt * 1.8) * 0.55 +
          (Math.random() * 2 - 1) * Math.exp(-bt * 8) * 0.25;
      }

      sampleL = Math.tanh((kick + bell + boom) * 1.15);
      sampleR = Math.tanh((kick + bell * 0.9 + boom) * 1.15);
    }

    left[i] = Math.max(-0.92, Math.min(0.92, sampleL));
    right[i] = Math.max(-0.92, Math.min(0.92, sampleR));
  }

  return buffer;
}

function drawDemoFrame(
  ctx: CanvasRenderingContext2D,
  clipId: DemoClipMeta['id'],
  width: number,
  height: number,
  t: number
) {
  const beat = (t % 0.5) / 0.5;
  const punch = Math.exp(-beat * 5.5);

  if (clipId === 'bouncing-chaos') {
    // Rich plasma gradient
    const g = ctx.createLinearGradient(0, 0, width, height);
    const h1 = (t * 60) % 360;
    g.addColorStop(0, `hsl(${h1}, 82%, 42%)`);
    g.addColorStop(0.5, `hsl(${(h1 + 90) % 360}, 85%, 36%)`);
    g.addColorStop(1, `hsl(${(h1 + 190) % 360}, 80%, 28%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    // Checkerboard floor ribbon
    const rows = 6;
    const cols = 10;
    const cw = width / cols;
    const ch = (height * 0.35) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r + c) % 2 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.16)';
          ctx.fillRect(c * cw + ((t * 90) % cw) - cw, height * 0.65 + r * ch, cw, ch);
        }
      }
    }

    // Pulsing center ring
    ctx.save();
    ctx.translate(width * 0.5, height * 0.48);
    ctx.scale(1 + punch * 0.25, 1 + punch * 0.25);
    ctx.strokeStyle = '#ffe600';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(0, 0, 88, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = 'bold 116px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const mainEmoji = Math.floor(t / 1.0) % 2 === 0 ? '🗿' : '💀';
    ctx.fillText(mainEmoji, 0, 6);
    ctx.restore();

    // Orbiting side emojis
    const orbit = ['🔥', '💯', '🤡', '⚡'];
    ctx.font = '56px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    orbit.forEach((em, idx) => {
      const ang = t * 2.6 + (idx * Math.PI) / 2;
      const ex = width * 0.5 + Math.cos(ang) * 185;
      const ey = height * 0.48 + Math.sin(ang) * 115;
      ctx.fillText(em, ex, ey);
    });

    ctx.font = '900 32px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#fff';
    const banner = 'DEMO CLIP · TEST THE FRYER';
    ctx.strokeText(banner, width * 0.5, 42);
    ctx.fillText(banner, width * 0.5, 42);
  } else if (clipId === 'retro-prism') {
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#09031a');
    bg.addColorStop(0.55, '#2b0745');
    bg.addColorStop(1, '#100317');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Retro sun
    const sunGrad = ctx.createLinearGradient(0, 70, 0, 260);
    sunGrad.addColorStop(0, '#ffea00');
    sunGrad.addColorStop(0.5, '#ff6a00');
    sunGrad.addColorStop(1, '#ff006a');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.44, 110 + punch * 14, 0, Math.PI * 2);
    ctx.fill();

    // Perspective horizon grid
    ctx.strokeStyle = '#00f6ff';
    ctx.lineWidth = 2;
    const hy = height * 0.6;
    ctx.fillStyle = '#0f0524';
    ctx.fillRect(0, hy, width, height - hy);
    for (let i = -8; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(width * 0.5 + i * 22, hy);
      ctx.lineTo(width * 0.5 + i * 110, height);
      ctx.stroke();
    }
    for (let r = 0; r < 8; r++) {
      const z = ((r / 8 + t * 0.9) % 1);
      const y = hy + Math.pow(z, 2.2) * (height - hy);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 3D rotating cube wireframe
    const verts = [
      [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
      [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
    ];
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];
    const ax = t * 1.4;
    const ay = t * 2.1;
    const proj = verts.map(([vx, vy, vz]) => {
      const x1 = vx * Math.cos(ay) - vz * Math.sin(ay);
      const z1 = vx * Math.sin(ay) + vz * Math.cos(ay);
      const y2 = vy * Math.cos(ax) - z1 * Math.sin(ax);
      const z2 = vy * Math.sin(ax) + z1 * Math.cos(ax);
      const s = (110 + punch * 22) / (3.4 + z2);
      return [width * 0.5 + x1 * s * 2.1, height * 0.44 + y2 * s * 2.1];
    });
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    for (const [a, b] of edges) {
      ctx.beginPath();
      ctx.moveTo(proj[a][0], proj[a][1]);
      ctx.lineTo(proj[b][0], proj[b][1]);
      ctx.stroke();
    }

    ctx.font = '900 34px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#00f6ff';
    ctx.strokeText('HYPERCUBE 1999', width * 0.5, height - 28);
    ctx.fillText('HYPERCUBE 1999', width * 0.5, height - 28);
  } else {
    // DVD Corner Hit
    const flash = t >= 3.0 && t < 3.45 ? Math.exp(-(t - 3.0) * 6) : 0;
    ctx.fillStyle = flash > 0.1 ? `rgb(${Math.round(flash * 255)}, ${Math.round(flash * 140)}, 30)` : '#11131b';
    ctx.fillRect(0, 0, width, height);

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const boxW = 148;
    const boxH = 74;
    const maxX = width - boxW;
    const maxY = height - boxH;

    // Velocity engineered so at t = 3.0 it hits exact (maxX, maxY) corner!
    const vx = (maxX * 2) / 3.0;
    const vy = (maxY * 3) / 3.0;
    const pxRaw = (t * vx) % (maxX * 2);
    const pyRaw = (t * vy) % (maxY * 2);
    const bx = pxRaw > maxX ? maxX * 2 - pxRaw : pxRaw;
    const by = pyRaw > maxY ? maxY * 2 - pyRaw : pyRaw;

    const hue = Math.floor(t * 95) % 360;
    ctx.fillStyle = `hsl(${hue}, 92%, 52%)`;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeRect(bx, by, boxW, boxH);

    ctx.fillStyle = '#0b0b0e';
    ctx.font = '900 32px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FRY ME', bx + boxW * 0.5, by + boxH * 0.5 + 2);

    if (t >= 3.0) {
      ctx.font = '900 42px Impact, "Arial Black", sans-serif';
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#000';
      ctx.fillStyle = '#ffe600';
      ctx.strokeText('CORNER HIT!! 🔥', width * 0.5, height * 0.5);
      ctx.fillText('CORNER HIT!! 🔥', width * 0.5, height * 0.5);
    }
  }
}

export async function generateDemoVideoFile(clipId: DemoClipMeta['id']): Promise<File> {
  const width = 640;
  const height = clipId === 'dvd-corner' ? 360 : 480;
  const fps = 30;
  const durationSec = 4.5;
  const totalFrames = Math.round(durationSec * fps);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  const audioBuffer = synthesizeDemoAudio(clipId, durationSec, 48000);

  // Fast WebCodecs path via Mediabunny
  if (typeof VideoEncoder !== 'undefined') {
    const mp4Video = await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], {
      width,
      height,
      frameRate: fps,
      quality: new Quality('high'),
    });

    const useMp4 = mp4Video !== null;
    const format = useMp4 ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat();
    const videoCodec = useMp4
      ? mp4Video!
      : (await getFirstEncodableVideoCodec(['vp8', 'vp9'], { width, height })) ?? 'vp8';
    const audioCodec = await getFirstEncodableAudioCodec(
      useMp4 ? ['aac', 'opus'] : ['opus', 'vorbis'],
      { numberOfChannels: 2, sampleRate: 48000 }
    );

    const target = new BufferTarget();
    const output = new Output({ format, target });

    const videoSource = new CanvasSource(canvas, {
      codec: videoCodec,
      quality: new Quality('high'),
    });
    output.addVideoTrack(videoSource, { frameRate: fps });

    let audioSource: AudioBufferSource | null = null;
    if (audioCodec) {
      audioSource = new AudioBufferSource({
        codec: audioCodec,
        quality: new Quality('high'),
      });
      output.addAudioTrack(audioSource);
    }

    await output.start();

    const frameDur = 1 / fps;
    const feedFrames = async () => {
      for (let i = 0; i < totalFrames; i++) {
        drawDemoFrame(ctx, clipId, width, height, i * frameDur);
        await videoSource.add(i * frameDur, frameDur);
      }
      videoSource.close();
    };

    const feedAudio = async () => {
      if (audioSource) {
        await audioSource.add(audioBuffer);
        audioSource.close();
      }
    };

    await Promise.all([feedFrames(), feedAudio()]);
    await output.finalize();

    const ext = useMp4 ? 'mp4' : 'webm';
    const mime = useMp4 ? 'video/mp4' : 'video/webm';
    const blob = new Blob([target.buffer!], { type: mime });
    return new File([blob], `demo_${clipId}.${ext}`, { type: mime });
  }

  // Fallback for browsers without WebCodecs
  const stream = canvas.captureStream(fps);
  const actx = new AudioContext({ sampleRate: 48000 });
  const dest = actx.createMediaStreamDestination();
  const src = actx.createBufferSource();
  src.buffer = audioBuffer;
  src.connect(dest);
  dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));

  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const stopped = new Promise<Blob>((res) => {
    recorder.onstop = () => res(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }));
  });

  recorder.start();
  src.start();
  const t0 = performance.now();
  await new Promise<void>((res) => {
    const loop = () => {
      const t = (performance.now() - t0) / 1000;
      if (t >= durationSec) {
        res();
        return;
      }
      drawDemoFrame(ctx, clipId, width, height, t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  src.stop();
  recorder.stop();
  const blob = await stopped;
  await actx.close().catch(() => {});
  return new File([blob], `demo_${clipId}.webm`, { type: blob.type });
}
