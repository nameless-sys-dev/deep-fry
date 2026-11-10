import { FrySettings } from '../types/fry';

const VERTEX_SHADER = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;

void main() {
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_tex;
uniform sampler2D u_rawTex;
uniform vec2 u_res;
uniform float u_time;
uniform float u_bass;
uniform float u_splitPos;
uniform float u_bypass;
uniform float u_passthru;

// Fry uniforms
uniform float u_sharpen;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_brightness;
uniform float u_highlightBurn;
uniform float u_redTint;
uniform float u_hueShiftRad;
uniform float u_posterize;
uniform float u_vignette;
uniform float u_thermalInvert;
uniform float u_blockArtifact;
uniform float u_rgbSplit;
uniform float u_audioShake;
uniform float u_vhsWobble;
uniform float u_noise;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 rgbToYuv(vec3 rgb) {
  float y = dot(rgb, vec3(0.299, 0.587, 0.114));
  float u = (rgb.b - y) * 0.565;
  float v = (rgb.r - y) * 0.713;
  return vec3(y, u, v);
}

vec3 yuvToRgb(vec3 yuv) {
  float r = yuv.x + 1.403 * yuv.z;
  float g = yuv.x - 0.344 * yuv.y - 0.714 * yuv.z;
  float b = yuv.x + 1.770 * yuv.y;
  return vec3(r, g, b);
}

vec3 rotateHue(vec3 col, float angle) {
  if (abs(angle) < 0.001) return col;
  vec3 k = vec3(0.57735);
  float cosA = cos(angle);
  float sinA = sin(angle);
  return col * cosA + cross(k, col) * sinA + k * dot(k, col) * (1.0 - cosA);
}

vec3 sampleSharp(vec2 uv, vec2 px) {
  vec3 c = texture(u_tex, clamp(uv, 0.001, 0.999)).rgb;
  if (u_sharpen <= 0.01) return c;
  float r = 1.0 + u_sharpen * 0.45;
  vec3 n1 = texture(u_tex, clamp(uv + vec2(px.x * r, 0.0), 0.001, 0.999)).rgb;
  vec3 n2 = texture(u_tex, clamp(uv - vec2(px.x * r, 0.0), 0.001, 0.999)).rgb;
  vec3 n3 = texture(u_tex, clamp(uv + vec2(0.0, px.y * r), 0.001, 0.999)).rgb;
  vec3 n4 = texture(u_tex, clamp(uv - vec2(0.0, px.y * r), 0.001, 0.999)).rgb;
  vec3 blur = (n1 + n2 + n3 + n4) * 0.25;
  vec3 high = c - blur;
  return c + high * (u_sharpen * 2.35);
}

void main() {
  // Raw bypass or left side of split-screen comparison
  if (u_bypass > 0.5 || (u_splitPos > 0.001 && v_uv.x < u_splitPos)) {
    vec3 raw = texture(u_rawTex, v_uv).rgb;
    outColor = vec4(raw, 1.0);
    return;
  }

  if (u_passthru > 0.5) {
    outColor = vec4(texture(u_tex, v_uv).rgb, 1.0);
    return;
  }

  vec2 uv = v_uv;
  vec2 px = 1.0 / max(u_res, vec2(16.0));

  // 1. Audio-reactive zoom & screen shake
  float shakeAmt = u_bass * u_audioShake;
  if (shakeAmt > 0.005) {
    float t = floor(u_time * 30.0);
    vec2 j = vec2(
      hash12(vec2(t, 1.7)) - 0.5,
      hash12(vec2(t, 9.3)) - 0.5
    ) * 2.0;
    float zoom = 1.0 + shakeAmt * 0.16;
    uv = (uv - 0.5) / zoom + 0.5 + j * (shakeAmt * 0.045);
  }

  // 2. VHS horizontal tracking wobble & sync tear
  if (u_vhsWobble > 0.01) {
    float wave = sin(uv.y * 38.0 + u_time * 18.0) * 0.008 * u_vhsWobble;
    float tearBand = smoothstep(0.92, 1.0, sin(uv.y * 4.0 - u_time * 3.7));
    float tearJitter = (hash12(vec2(floor(uv.y * 90.0), floor(u_time * 24.0))) - 0.5) * 0.075 * tearBand * u_vhsWobble;
    uv.x += wave + tearJitter;
  }

  // 3. Chromatic aberration (RGB split) + bass boost
  float ca = u_rgbSplit * 0.018 + shakeAmt * 0.016;
  vec3 col;
  if (ca > 0.0005) {
    float r = sampleSharp(uv + vec2(ca, ca * 0.25), px).r;
    float g = sampleSharp(uv, px).g;
    float b = sampleSharp(uv - vec2(ca, -ca * 0.25), px).b;
    col = vec3(r, g, b);
  } else {
    col = sampleSharp(uv, px);
  }

  // 4. Color fry: brightness, contrast, highlight burn, saturation, hue, red/orange bias
  col *= u_brightness;
  col = (col - 0.5) * u_contrast + 0.5;
  col = max(col, 0.0);

  if (u_highlightBurn > 0.01) {
    vec3 burned = pow(col, vec3(0.62)) * (1.0 + u_highlightBurn * 0.35);
    col = mix(col, burned, u_highlightBurn);
  }

  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(luma), col, u_saturation);

  col = rotateHue(col, u_hueShiftRad);

  if (u_redTint > 0.01) {
    vec3 warmBias = vec3(0.38, 0.08, -0.22) * (0.4 + luma * 0.9);
    col += warmBias * u_redTint;
  }

  col = clamp(col, 0.0, 1.0);

  // 5. Posterize (bit-depth crush)
  if (u_posterize > 1.5) {
    col = floor(col * u_posterize + 0.5) / u_posterize;
  }

  // 6. Thermal / Negative inversion
  if (u_thermalInvert > 0.5) {
    col = 1.0 - col;
  }

  // 7. GPU 8x8 Macroblock DCT & 4:2:0 Chroma Subsampling Crunch
  if (u_blockArtifact > 0.01) {
    float blockSize = mix(4.0, 10.0, u_blockArtifact);
    vec2 blockGrid = floor(uv * u_res / blockSize) * blockSize / u_res;
    vec2 blockCenter = blockGrid + (blockSize * 0.5) * px;

    // Coarser chroma block sampling (4:2:0 color bleed)
    float chromaSize = blockSize * 1.5;
    vec2 chromaGrid = floor(uv * u_res / chromaSize) * chromaSize / u_res + (chromaSize * 0.5) * px;

    vec3 blockCol = texture(u_tex, clamp(blockCenter, 0.001, 0.999)).rgb;
    blockCol = (blockCol - 0.5) * u_contrast + 0.5;
    blockCol = mix(vec3(dot(blockCol, vec3(0.299, 0.587, 0.114))), clamp(blockCol, 0.0, 1.0), u_saturation);
    blockCol = rotateHue(blockCol, u_hueShiftRad);
    if (u_thermalInvert > 0.5) blockCol = 1.0 - blockCol;

    vec3 chromaCol = texture(u_tex, clamp(chromaGrid, 0.001, 0.999)).rgb;
    chromaCol = (chromaCol - 0.5) * u_contrast + 0.5;
    chromaCol = mix(vec3(dot(chromaCol, vec3(0.299, 0.587, 0.114))), clamp(chromaCol, 0.0, 1.0), u_saturation);
    chromaCol = rotateHue(chromaCol, u_hueShiftRad);
    if (u_thermalInvert > 0.5) chromaCol = 1.0 - chromaCol;

    vec3 yuvPix = rgbToYuv(col);
    vec3 yuvBlk = rgbToYuv(blockCol);
    vec3 yuvChr = rgbToYuv(chromaCol);

    // Quantize block luma + bleed chroma across macroblocks
    float qLevels = mix(36.0, 6.0, u_blockArtifact);
    float quantY = floor(mix(yuvPix.x, yuvBlk.x, u_blockArtifact * 0.58) * qLevels + 0.5) / qLevels;
    vec2 bleedUV = mix(yuvPix.yz, yuvChr.yz, min(1.0, u_blockArtifact * 1.1));
    bleedUV = floor(bleedUV * (qLevels * 0.7) + 0.5) / (qLevels * 0.7);

    // Edge ringing / mosquito noise along 8x8 boundaries
    vec2 inBlock = fract(uv * u_res / blockSize);
    float edgeMask = step(0.85, max(inBlock.x, inBlock.y)) * u_blockArtifact;
    float ring = (hash12(floor(uv * u_res / 2.0) + floor(u_time * 15.0)) - 0.5) * 0.18 * edgeMask;

    col = clamp(yuvToRgb(vec3(quantY + ring, bleedUV)), 0.0, 1.0);
  }

  // 8. VHS scanlines
  if (u_vhsWobble > 0.01) {
    float scan = sin(uv.y * u_res.y * 1.65) * 0.5 + 0.5;
    col *= mix(1.0, 0.72 + 0.28 * scan, u_vhsWobble * 0.85);
  }

  // 9. Crusty digital grain / compression noise
  if (u_noise > 0.01 || shakeAmt > 0.2) {
    float nAmt = u_noise * 0.24 + shakeAmt * 0.06;
    float n = hash12(uv * u_res + vec2(fract(u_time * 31.7) * 512.0, fract(u_time * 13.3) * 512.0)) - 0.5;
    col += vec3(n * nAmt);
  }

  // 10. Charred vignette burn
  if (u_vignette > 0.01) {
    float dist = distance(v_uv, vec2(0.5));
    float vig = smoothstep(0.88 - u_vignette * 0.45, 0.22, dist);
    col *= mix(1.0 - u_vignette * 0.85, 1.0, vig);
  }

  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

const MEME_EMOJIS = ['😂', '💯', '🔥', '💀', '👌', '🅱️'];

interface StampSeed {
  emoji: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  scale: number;
}

const STAMP_SEEDS: StampSeed[] = [
  { emoji: '😂', x: 0.13, y: 0.82, vx: 0.17, vy: -0.11, rot: -0.22, scale: 1.05 },
  { emoji: '💯', x: 0.86, y: 0.18, vx: -0.13, vy: 0.19, rot: 0.18, scale: 0.95 },
  { emoji: '🔥', x: 0.86, y: 0.83, vx: -0.21, vy: -0.14, rot: 0.24, scale: 1.0 },
  { emoji: '💀', x: 0.14, y: 0.19, vx: 0.15, vy: 0.16, rot: -0.15, scale: 0.9 },
  { emoji: '👌', x: 0.52, y: 0.87, vx: 0.23, vy: -0.18, rot: 0.12, scale: 0.88 },
  { emoji: '🅱️', x: 0.5, y: 0.14, vx: -0.18, vy: 0.22, rot: -0.2, scale: 0.92 },
];

function wrapTextLines(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().toUpperCase().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawImpactBlock(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  width: number,
  height: number,
  position: 'top' | 'bottom',
  scale: number
) {
  if (!text.trim()) return;
  const fontSize = Math.max(14, Math.round(height * 0.095 * scale));
  ctx.save();
  ctx.font = `900 ${fontSize}px Impact, "Arial Black", "Space Grotesk", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = position === 'top' ? 'top' : 'bottom';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  const maxWidth = width * 0.92;
  const lines = wrapTextLines(ctx, text, maxWidth);
  const lineHeight = fontSize * 1.08;
  const margin = Math.max(6, Math.round(height * 0.035));

  ctx.lineWidth = Math.max(2.5, fontSize * 0.14);
  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#ffffff';

  lines.forEach((line, idx) => {
    const y =
      position === 'top'
        ? margin + idx * lineHeight
        : height - margin - (lines.length - 1 - idx) * lineHeight;
    ctx.strokeText(line, width * 0.5, y);
    ctx.fillText(line, width * 0.5, y);
  });
  ctx.restore();
}

function drawLensFlare(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  xNorm: number,
  yNorm: number,
  intensity: number,
  bassLevel: number
) {
  const cx = xNorm * width;
  const cy = yNorm * height;
  const pulse = 1 + bassLevel * 0.55;
  const radius = Math.max(width, height) * 0.24 * intensity * pulse;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Outer red/amber bloom
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0, 'rgba(255, 255, 240, 0.95)');
  grad.addColorStop(0.18, 'rgba(255, 110, 20, 0.85)');
  grad.addColorStop(0.45, 'rgba(255, 15, 15, 0.45)');
  grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Horizontal anamorphic laser streak
  const streakGrad = ctx.createLinearGradient(cx - radius * 1.8, cy, cx + radius * 1.8, cy);
  streakGrad.addColorStop(0, 'rgba(255, 30, 0, 0)');
  streakGrad.addColorStop(0.35, 'rgba(255, 60, 10, 0.55)');
  streakGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
  streakGrad.addColorStop(0.65, 'rgba(255, 60, 10, 0.55)');
  streakGrad.addColorStop(1, 'rgba(255, 30, 0, 0)');
  ctx.fillStyle = streakGrad;
  const streakH = Math.max(2, radius * 0.08);
  ctx.fillRect(cx - radius * 1.8, cy - streakH * 0.5, radius * 3.6, streakH);

  // Diagonal 4-point star spikes
  ctx.strokeStyle = 'rgba(255, 200, 140, 0.7)';
  ctx.lineWidth = Math.max(1.5, radius * 0.035);
  for (const ang of [Math.PI * 0.25, -Math.PI * 0.25, Math.PI * 0.5]) {
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(ang) * radius * 0.9, cy - Math.sin(ang) * radius * 0.9);
    ctx.lineTo(cx + Math.cos(ang) * radius * 0.9, cy + Math.sin(ang) * radius * 0.9);
    ctx.stroke();
  }

  ctx.restore();
}

function drawEmojiChaos(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  timeSec: number,
  chaosAmount: number,
  bassLevel: number
) {
  if (chaosAmount <= 0.02) return;
  const count = Math.max(1, Math.round(chaosAmount * STAMP_SEEDS.length));
  const baseSize = Math.max(18, Math.round(Math.min(width, height) * (0.14 + chaosAmount * 0.09)));

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < count; i++) {
    const seed = STAMP_SEEDS[i % STAMP_SEEDS.length];
    // Ping-pong bounce within viewport margins
    const rawX = Math.abs(((seed.x + timeSec * seed.vx) % 1.6) - 0.8);
    const rawY = Math.abs(((seed.y + timeSec * seed.vy) % 1.6) - 0.8);
    const px = (0.1 + rawX * 0.95) * width;
    const py = (0.1 + rawY * 0.95) * height;
    const wobble = Math.sin(timeSec * 8 + i * 2.1) * 0.25 + seed.rot;
    const pulse = 1 + bassLevel * 0.35;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(wobble);
    ctx.scale(seed.scale * pulse, seed.scale * pulse);
    ctx.shadowColor = 'rgba(255, 60, 0, 0.8)';
    ctx.shadowBlur = baseSize * 0.3;
    ctx.font = `${baseSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.fillText(MEME_EMOJIS[i % MEME_EMOJIS.length], 0, 0);
    ctx.restore();
  }

  ctx.restore();
}

export function hasMemeOverlays(settings: FrySettings): boolean {
  return (
    settings.topCaption.trim().length > 0 ||
    settings.bottomCaption.trim().length > 0 ||
    settings.lensFlare ||
    settings.emojiChaos > 0.02
  );
}

export class WebGLFryer {
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private texFry: WebGLTexture | null = null;
  private texRaw: WebGLTexture | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};

  private stagingCanvas: HTMLCanvasElement | OffscreenCanvas;
  private stagingCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  private fallback2dCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

  constructor(canvas?: HTMLCanvasElement | OffscreenCanvas) {
    if (canvas) {
      this.canvas = canvas;
    } else if (typeof OffscreenCanvas !== 'undefined') {
      this.canvas = new OffscreenCanvas(320, 240);
    } else {
      const c = document.createElement('canvas');
      c.width = 320;
      c.height = 240;
      this.canvas = c;
    }

    if (typeof OffscreenCanvas !== 'undefined') {
      this.stagingCanvas = new OffscreenCanvas(320, 240);
    } else {
      const c = document.createElement('canvas');
      c.width = 320;
      c.height = 240;
      this.stagingCanvas = c;
    }
    this.stagingCtx = this.stagingCanvas.getContext('2d', { alpha: false }) as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D;

    this.initWebGL();
  }

  get outputCanvas(): HTMLCanvasElement | OffscreenCanvas {
    return this.canvas;
  }

  get isWebGLAvailable(): boolean {
    return this.gl !== null && this.program !== null;
  }

  private initWebGL() {
    const gl = this.canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    }) as WebGL2RenderingContext | null;

    if (!gl) {
      this.fallback2dCtx = this.canvas.getContext('2d', { alpha: false }) as
        | CanvasRenderingContext2D
        | OffscreenCanvasRenderingContext2D
        | null;
      return;
    }

    const vs = this.compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = this.compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('WebGLFryer link error:', gl.getProgramInfoLog(prog));
      gl.deleteProgram(prog);
      return;
    }

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    const makeTex = () => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return tex;
    };

    this.texFry = makeTex();
    this.texRaw = makeTex();
    this.vao = vao;
    this.program = prog;
    this.gl = gl;

    const uniformNames = [
      'u_tex',
      'u_rawTex',
      'u_res',
      'u_time',
      'u_bass',
      'u_splitPos',
      'u_bypass',
      'u_passthru',
      'u_sharpen',
      'u_contrast',
      'u_saturation',
      'u_brightness',
      'u_highlightBurn',
      'u_redTint',
      'u_hueShiftRad',
      'u_posterize',
      'u_vignette',
      'u_thermalInvert',
      'u_blockArtifact',
      'u_rgbSplit',
      'u_audioShake',
      'u_vhsWobble',
      'u_noise',
    ];
    for (const name of uniformNames) {
      this.uniforms[name] = gl.getUniformLocation(prog, name);
    }
  }

  private compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('WebGLFryer shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  /**
   * Renders a source video/canvas frame onto `stagingCanvas` at target resolution,
   * baking scaling mode + meme overlays, and returns `stagingCanvas`.
   */
  composeStaging(
    source: TexImageSource & CanvasImageSource,
    targetWidth: number,
    targetHeight: number,
    settings: FrySettings,
    timeSec: number,
    bassLevel: number
  ): HTMLCanvasElement | OffscreenCanvas {
    if (this.stagingCanvas.width !== targetWidth || this.stagingCanvas.height !== targetHeight) {
      this.stagingCanvas.width = targetWidth;
      this.stagingCanvas.height = targetHeight;
    }

    const ctx = this.stagingCtx;
    ctx.imageSmoothingEnabled = settings.scaleMode === 'muddy';
    if ('imageSmoothingQuality' in ctx) {
      ctx.imageSmoothingQuality = settings.scaleMode === 'muddy' ? 'medium' : 'low';
    }
    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

    if (settings.lensFlare) {
      drawLensFlare(
        ctx,
        targetWidth,
        targetHeight,
        settings.flareX,
        settings.flareY,
        settings.flareIntensity,
        bassLevel
      );
    }

    if (settings.emojiChaos > 0.02) {
      drawEmojiChaos(ctx, targetWidth, targetHeight, timeSec, settings.emojiChaos, bassLevel);
    }

    if (settings.topCaption.trim()) {
      drawImpactBlock(ctx, settings.topCaption, targetWidth, targetHeight, 'top', settings.captionScale);
    }
    if (settings.bottomCaption.trim()) {
      drawImpactBlock(ctx, settings.bottomCaption, targetWidth, targetHeight, 'bottom', settings.captionScale);
    }

    return this.stagingCanvas;
  }

  /**
   * Renders deep-fried frame into the output canvas.
   * `rawSource` is used for the Left half of split-screen comparison or full bypass.
   */
  renderFrame(options: {
    friedInput: TexImageSource & CanvasImageSource;
    rawInput?: TexImageSource & CanvasImageSource;
    outputWidth: number;
    outputHeight: number;
    targetResWidth: number;
    targetResHeight: number;
    settings: FrySettings;
    timeSec: number;
    bassLevel: number;
    splitPos?: number; // 0 = full fried, 0..1 = split divider
    bypass?: boolean;
    passthruFried?: boolean;
  }) {
    const {
      friedInput,
      rawInput,
      outputWidth,
      outputHeight,
      targetResWidth,
      targetResHeight,
      settings,
      timeSec,
      bassLevel,
      splitPos = 0,
      bypass = false,
      passthruFried = false,
    } = options;

    if (this.canvas.width !== outputWidth || this.canvas.height !== outputHeight) {
      this.canvas.width = outputWidth;
      this.canvas.height = outputHeight;
    }

    const gl = this.gl;
    if (!gl || !this.program || !this.vao) {
      // Graceful 2D fallback if WebGL2 isn't available
      if (this.fallback2dCtx) {
        const ctx = this.fallback2dCtx;
        ctx.imageSmoothingEnabled = settings.scaleMode === 'muddy';
        if (bypass) {
          ctx.filter = 'none';
          ctx.drawImage(rawInput ?? friedInput, 0, 0, outputWidth, outputHeight);
        } else {
          ctx.filter = `contrast(${Math.round(settings.contrast * 100)}%) saturate(${Math.round(
            settings.saturation * 100
          )}%) brightness(${Math.round(settings.brightness * 100)}%) hue-rotate(${settings.hueShift}deg)`;
          ctx.drawImage(friedInput, 0, 0, outputWidth, outputHeight);
          ctx.filter = 'none';
        }
      }
      return;
    }

    gl.viewport(0, 0, outputWidth, outputHeight);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    const filterMode = settings.scaleMode === 'blocky' ? gl.NEAREST : gl.LINEAR;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texFry);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filterMode);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filterMode);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, friedInput);
    gl.uniform1i(this.uniforms.u_tex, 0);

    if (bypass || splitPos > 0.001) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.texRaw);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, rawInput ?? friedInput);
      gl.uniform1i(this.uniforms.u_rawTex, 1);
    }

    gl.uniform2f(this.uniforms.u_res, targetResWidth, targetResHeight);
    gl.uniform1f(this.uniforms.u_time, timeSec);
    gl.uniform1f(this.uniforms.u_bass, bassLevel);
    gl.uniform1f(this.uniforms.u_splitPos, splitPos);
    gl.uniform1f(this.uniforms.u_bypass, bypass ? 1.0 : 0.0);
    gl.uniform1f(this.uniforms.u_passthru, passthruFried ? 1.0 : 0.0);

    gl.uniform1f(this.uniforms.u_sharpen, settings.sharpen);
    gl.uniform1f(this.uniforms.u_contrast, settings.contrast);
    gl.uniform1f(this.uniforms.u_saturation, settings.saturation);
    gl.uniform1f(this.uniforms.u_brightness, settings.brightness);
    gl.uniform1f(this.uniforms.u_highlightBurn, settings.highlightBurn);
    gl.uniform1f(this.uniforms.u_redTint, settings.redTint);
    gl.uniform1f(this.uniforms.u_hueShiftRad, (settings.hueShift * Math.PI) / 180);
    gl.uniform1f(this.uniforms.u_posterize, settings.posterize);
    gl.uniform1f(this.uniforms.u_vignette, settings.vignette);
    gl.uniform1f(this.uniforms.u_thermalInvert, settings.thermalInvert ? 1.0 : 0.0);
    gl.uniform1f(this.uniforms.u_blockArtifact, settings.blockArtifact);
    gl.uniform1f(this.uniforms.u_rgbSplit, settings.rgbSplit);
    gl.uniform1f(this.uniforms.u_audioShake, settings.audioShake);
    gl.uniform1f(this.uniforms.u_vhsWobble, settings.vhsWobble);
    gl.uniform1f(this.uniforms.u_noise, settings.noise);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }

  dispose() {
    const gl = this.gl;
    if (!gl) return;
    if (this.texFry) gl.deleteTexture(this.texFry);
    if (this.texRaw) gl.deleteTexture(this.texRaw);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.program) gl.deleteProgram(this.program);
    this.gl = null;
    this.program = null;
  }
}
