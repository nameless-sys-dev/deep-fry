import React, { useEffect, useRef, useState } from 'react';
import { Camera, Circle, Square, X } from 'lucide-react';

interface WebcamModalProps {
  open: boolean;
  onClose: () => void;
  onCaptured: (file: File) => void;
}

export const WebcamModal: React.FC<WebcamModalProps> = ({ open, onClose, onCaptured }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setError(null);
    setRecording(false);
    setElapsed(0);

    const startCam = async () => {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
            audio: true,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? `Camera access denied or unavailable: ${err.message}`
            : 'Camera access denied or unavailable.'
        );
      }
    };

    void startCam();

    return () => {
      active = false;
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!recording) return;
    const t0 = performance.now();
    const id = window.setInterval(() => {
      const sec = (performance.now() - t0) / 1000;
      setElapsed(sec);
      if (sec >= 15) {
        stopRecording();
      }
    }, 100);
    return () => clearInterval(id);
  }, [recording]);

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const preferred = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
    ].find((m) => MediaRecorder.isTypeSupported(m));

    const rec = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const mime = rec.mimeType || 'video/webm';
      const ext = mime.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunksRef.current, { type: mime });
      if (blob.size > 0) {
        const file = new File([blob], `webcam_clip.${ext}`, { type: mime });
        onCaptured(file);
        onClose();
      }
    };
    recorderRef.current = rec;
    rec.start(150);
    setElapsed(0);
    setRecording(true);
  };

  const stopRecording = () => {
    setRecording(false);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[#2d2d3a] bg-[#121217] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#23232e] bg-[#0e0e12]">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-[#ff6b1a]" />
            <h2 className="text-sm font-bold text-[#f5f2eb]">Record Quick Clip (Max 15s)</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#8e8a81] hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative bg-black aspect-[4/3] flex items-center justify-center">
          {error ? (
            <p className="text-xs text-[#ff6b81] px-6 text-center">{error}</p>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover -scale-x-100"
            />
          )}
          {recording && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 border border-[#ff2e4c]/60 text-xs font-mono text-white">
              <span className="h-2 w-2 rounded-full bg-[#ff2e4c] animate-pulse" />
              <span>REC {elapsed.toFixed(1)}s / 15.0s</span>
            </div>
          )}
        </div>

        <div className="p-4 flex items-center justify-between gap-3">
          <span className="text-[11px] text-[#8e8a81]">
            Audio + video stays 100% local
          </span>
          {recording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="px-4 py-2 rounded-xl bg-[#ff2e4c] text-white font-bold text-xs flex items-center gap-1.5 hover:brightness-110 cursor-pointer"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              Stop & Fry
            </button>
          ) : (
            <button
              type="button"
              disabled={Boolean(error)}
              onClick={startRecording}
              className="px-4 py-2 rounded-xl bg-[#ff6b1a] text-black font-bold text-xs flex items-center gap-1.5 hover:bg-[#ff813b] cursor-pointer disabled:opacity-40"
            >
              <Circle className="h-3.5 w-3.5 fill-current" />
              Start Recording
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
