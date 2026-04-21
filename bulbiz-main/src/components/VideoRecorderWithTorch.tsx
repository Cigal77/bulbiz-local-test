import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Video, Square, Zap, ZapOff, X, RotateCcw } from "lucide-react";

interface VideoRecorderWithTorchProps {
  open: boolean;
  onClose: () => void;
  onVideoRecorded: (file: File) => void;
}

export function VideoRecorderWithTorch({ open, onClose, onVideoRecorded }: VideoRecorderWithTorchProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [recording, setRecording] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCamera = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Try to enable torch
      const videoTrack = stream.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities?.() as any;
      if (capabilities?.torch) {
        setTorchSupported(true);
        try {
          await videoTrack.applyConstraints({ advanced: [{ torch: true } as any] });
          setTorchOn(true);
        } catch {
          // torch failed silently
        }
      }
    } catch (e: any) {
      if (e.name === "NotAllowedError") {
        setError("Accès à la caméra refusé. Autorisez l'accès dans les paramètres de votre navigateur.");
      } else {
        setError("Impossible d'accéder à la caméra.");
      }
    } finally {
      setStarting(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
    setTorchOn(false);
    setTorchSupported(false);
    setDuration(0);
  }, []);

  const toggleTorch = useCallback(async () => {
    const stream = streamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    try {
      await videoTrack.applyConstraints({ advanced: [{ torch: !torchOn } as any] });
      setTorchOn(!torchOn);
    } catch {
      // ignore
    }
  }, [torchOn]);

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;

    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "video/mp4";

    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `video_${Date.now()}.${ext}`, { type: mimeType });
      onVideoRecorded(file);
      handleClose();
    };

    mediaRecorderRef.current = recorder;
    recorder.start(1000);
    setRecording(true);
    setDuration(0);
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  }, [onVideoRecorded]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
  }, []);

  const handleClose = useCallback(() => {
    if (recording) {
      mediaRecorderRef.current?.stop();
    }
    stopCamera();
    onClose();
  }, [recording, stopCamera, onClose]);

  useEffect(() => {
    if (open) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [open]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Enregistrer une vidéo
          </DialogTitle>
        </DialogHeader>

        <div className="relative bg-black aspect-[4/3]">
          {starting && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4">
              <p className="text-white text-sm text-center">{error}</p>
              <Button variant="secondary" size="sm" onClick={startCamera} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
                Réessayer
              </Button>
            </div>
          )}
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />

          {/* Duration overlay */}
          {recording && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white text-sm font-mono">{formatDuration(duration)}</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-6 p-4">
          {/* Torch toggle */}
          {torchSupported && (
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={toggleTorch}
            >
              {torchOn ? <Zap className="h-5 w-5 text-yellow-500" /> : <ZapOff className="h-5 w-5 text-muted-foreground" />}
            </Button>
          )}

          {/* Record / Stop button */}
          {!recording ? (
            <button
              onClick={startRecording}
              disabled={starting || !!error}
              className="h-16 w-16 rounded-full border-4 border-red-500 flex items-center justify-center disabled:opacity-50 transition-transform active:scale-95"
            >
              <div className="h-12 w-12 rounded-full bg-red-500" />
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="h-16 w-16 rounded-full border-4 border-red-500 flex items-center justify-center transition-transform active:scale-95"
            >
              <Square className="h-7 w-7 text-red-500 fill-red-500" />
            </button>
          )}

          {/* Close */}
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={handleClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
