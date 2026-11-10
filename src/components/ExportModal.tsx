import React from 'react';
import {
  CheckCircle2,
  Download,
  Flame,
  RefreshCw,
  X,
  Zap,
} from 'lucide-react';
import { ExportResult, formatBytes, formatTimecode } from '../types/fry';

interface ExportModalProps {
  result: ExportResult | null;
  onClose: () => void;
  onReFry: (file: File) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  result,
  onClose,
  onReFry,
}) => {
  if (!result) return null;

  const sizeDiffPct =
    result.originalSize > 0
      ? Math.round(((result.originalSize - result.outputSize) / result.originalSize) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-[#2d2d3a] bg-[#121217] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#23232e] bg-[#0e0e12]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#a3e635]/15 border border-[#a3e635]/40">
              <CheckCircle2 className="h-4.5 w-4.5 text-[#a3e635]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#f5f2eb]">
                Fresh Out of the Fryer
              </h2>
              <p className="text-[11px] font-mono text-[#9b978e]">
                {result.fileName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8e8a81] hover:text-white hover:bg-[#1e1e26] transition-colors cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Video Preview */}
        <div className="bg-black flex items-center justify-center max-h-[48vh] overflow-hidden border-b border-[#23232e]">
          <video
            src={result.url}
            controls
            autoPlay
            loop
            playsInline
            className="max-h-[48vh] w-auto max-w-full"
          />
        </div>

        {/* Metrics Grid */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-xl bg-[#181820] border border-[#262633] p-2.5">
              <div className="text-[10px] font-mono uppercase text-[#8e8a81]">Size Drop</div>
              <div className="mt-0.5 font-mono text-sm font-bold text-[#a3e635]">
                {formatBytes(result.outputSize)}
              </div>
              <div className="text-[10px] font-mono text-[#9b978e]">
                from {formatBytes(result.originalSize)}{' '}
                {sizeDiffPct >= 0 ? `(-${sizeDiffPct}%)` : `(+${Math.abs(sizeDiffPct)}%)`}
              </div>
            </div>

            <div className="rounded-xl bg-[#181820] border border-[#262633] p-2.5">
              <div className="text-[10px] font-mono uppercase text-[#8e8a81]">Render Speed</div>
              <div className="mt-0.5 font-mono text-sm font-bold text-[#ff9500] flex items-center gap-1">
                <Zap className="h-3.5 w-3.5 fill-current" />
                {result.realtimeFactor.toFixed(1)}×
              </div>
              <div className="text-[10px] font-mono text-[#9b978e]">
                in {result.encodeTimeSec.toFixed(2)}s ({result.engine})
              </div>
            </div>

            <div className="rounded-xl bg-[#181820] border border-[#262633] p-2.5">
              <div className="text-[10px] font-mono uppercase text-[#8e8a81]">Resolution</div>
              <div className="mt-0.5 font-mono text-sm font-bold text-[#f5f2eb]">
                {result.outputWidth}×{result.outputHeight}
              </div>
              <div className="text-[10px] font-mono text-[#9b978e]">
                {formatTimecode(result.outputDuration)} clip
              </div>
            </div>

            <div className="rounded-xl bg-[#181820] border border-[#262633] p-2.5">
              <div className="text-[10px] font-mono uppercase text-[#8e8a81]">Codecs</div>
              <div className="mt-0.5 font-mono text-sm font-bold text-[#f5f2eb]">
                {result.videoCodec}
              </div>
              <div className="text-[10px] font-mono text-[#9b978e]">
                {result.audioCodec ? `+ ${result.audioCodec}` : 'No audio'}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <a
              href={result.url}
              download={result.fileName}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#ff6b1a] to-[#ff2e4c] text-white font-bold text-sm flex items-center justify-center gap-2 hover:brightness-110 transition-all shadow-lg shadow-[#ff6b1a]/25"
            >
              <Download className="h-4 w-4" />
              <span>Download {result.fileName.split('.').pop()?.toUpperCase()}</span>
            </a>

            <button
              type="button"
              onClick={() => {
                onReFry(result.file);
                onClose();
              }}
              className="py-2.5 px-4 rounded-xl bg-[#1b1b24] border border-[#323244] hover:border-[#ff6b1a] text-[#f5f2eb] font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              title="Feed this deep-fried output back into the fryer for generational decay!"
            >
              <RefreshCw className="h-4 w-4 text-[#ff9500]" />
              <span>Fry It Again!</span>
              <Flame className="h-3.5 w-3.5 text-[#ff2e4c]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
