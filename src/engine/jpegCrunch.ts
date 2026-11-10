export class JpegCruncher {
  private scratchCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private scratchCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

  private ensureCanvas(width: number, height: number) {
    if (!this.scratchCanvas) {
      if (typeof OffscreenCanvas !== 'undefined') {
        this.scratchCanvas = new OffscreenCanvas(width, height);
      } else {
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        this.scratchCanvas = c;
      }
      this.scratchCtx = this.scratchCanvas.getContext('2d', { alpha: false }) as
        | CanvasRenderingContext2D
        | OffscreenCanvasRenderingContext2D
        | null;
    }

    if (this.scratchCanvas.width !== width || this.scratchCanvas.height !== height) {
      this.scratchCanvas.width = width;
      this.scratchCanvas.height = height;
    }

    return { canvas: this.scratchCanvas, ctx: this.scratchCtx! };
  }

  private async canvasToJpegBlob(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    quality01: number
  ): Promise<Blob> {
    if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
      return canvas.convertToBlob({ type: 'image/jpeg', quality: quality01 });
    }
    return new Promise<Blob>((resolve, reject) => {
      (canvas as HTMLCanvasElement).toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob returned null'));
        },
        'image/jpeg',
        quality01
      );
    });
  }

  /**
   * Runs `passes` rounds of real JPEG compression on `source` and writes the
   * resulting artifacted pixels into `targetCanvas` (or returns the scratch canvas).
   */
  async crunch(
    source: CanvasImageSource,
    width: number,
    height: number,
    passes: number,
    jpegQualityPercent: number
  ): Promise<HTMLCanvasElement | OffscreenCanvas> {
    const { canvas, ctx } = this.ensureCanvas(width, height);
    ctx.drawImage(source, 0, 0, width, height);

    if (passes <= 0) {
      return canvas;
    }

    const quality01 = Math.max(0.01, Math.min(0.92, jpegQualityPercent / 100));

    for (let i = 0; i < passes; i++) {
      // Slightly vary JPEG quality on alternating passes for harsher quantization clashes
      const passQ = Math.max(0.01, Math.min(0.9, quality01 * (i % 2 === 1 ? 0.85 : 1.0)));
      const blob = await this.canvasToJpegBlob(canvas, passQ);
      const bitmap = await createImageBitmap(blob);

      // Subtle 1px offset on intermediate passes misaligns 8x8 DCT blocks for classic repost crust
      const shiftX = i > 0 && passes > 1 ? (i % 2 === 0 ? 1 : -1) : 0;
      const shiftY = i > 0 && passes > 1 ? (i % 2 === 0 ? -1 : 1) : 0;

      ctx.drawImage(bitmap, shiftX, shiftY, width, height);
      bitmap.close();
    }

    return canvas;
  }
}
