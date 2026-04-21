import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mic, Square, Trash2, Save, Loader2 } from "lucide-react";

interface VoiceRecorderDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (blob: Blob, duration: number) => Promise<void>;
}

export function VoiceRecorderDialog({ open, onClose, onSave }: VoiceRecorderDialogProps) {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const MAX_DURATION = 300; // 5 minutes

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    clearTimer();
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    } catch (e) {
      console.warn("stopRecording error:", e);
    }
    setRecording(false);
  }, [clearTimer]);

  const startRecording = useCallback(async () => {
    setError(null);
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        // Stop the stream tracks when recording stops
        stopStream();
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          setAudioBlob(blob);
          setAudioUrl(URL.createObjectURL(blob));
        }
      };

      recorder.onerror = () => {
        clearTimer();
        stopStream();
        setRecording(false);
        setError("Erreur d'enregistrement. Réessayez.");
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      startTimeRef.current = Date.now();
      setRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);
        if (elapsed >= MAX_DURATION) {
          // Stop via ref to avoid stale closure
          clearTimer();
          try {
            if (mediaRecorderRef.current?.state === "recording") {
              mediaRecorderRef.current.stop();
            }
          } catch { /* ignore */ }
          setRecording(false);
        }
      }, 500);
    } catch (e: any) {
      stopStream();
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        setError("Accès au micro refusé. Autorisez l'accès dans les paramètres du navigateur.");
      } else if (e.name === "NotFoundError") {
        setError("Aucun micro détecté.");
      } else {
        setError("Impossible de démarrer l'enregistrement.");
      }
    }
  }, [audioUrl, clearTimer, stopStream]);

  const reset = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setError(null);
  }, [audioUrl]);

  const handleSave = async () => {
    if (!audioBlob) return;
    setSaving(true);
    try {
      await onSave(audioBlob, duration);
      reset();
      onClose();
    } catch {
      setError("Erreur lors de la sauvegarde. Réessayez.");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = useCallback(() => {
    if (recording) stopRecording();
    stopStream();
    reset();
    onClose();
  }, [recording, stopRecording, stopStream, reset, onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
      stopStream();
    };
  }, [clearTimer, stopStream]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Note vocale</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          {/* Timer */}
          <div className="text-4xl font-mono tabular-nums text-foreground">
            {formatTime(duration)}
          </div>

          {/* Waveform indicator */}
          {recording && (
            <div className="flex items-center gap-1 h-8">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-destructive rounded-full animate-pulse"
                  style={{
                    height: `${12 + Math.random() * 20}px`,
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          {/* Audio player */}
          {audioUrl && !recording && (
            <audio controls src={audioUrl} className="w-full" />
          )}

          {/* Controls */}
          <div className="flex items-center gap-3">
            {!recording && !audioBlob && (
              <Button size="lg" onClick={startRecording} className="gap-2 rounded-full px-6">
                <Mic className="h-5 w-5" />
                Démarrer
              </Button>
            )}

            {recording && (
              <Button size="lg" variant="destructive" onClick={stopRecording} className="gap-2 rounded-full px-6">
                <Square className="h-4 w-4" />
                Stop
              </Button>
            )}

            {audioBlob && !recording && (
              <>
                <Button variant="outline" onClick={reset} className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Supprimer
                </Button>
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Enregistrer
                </Button>
              </>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Max {MAX_DURATION / 60} minutes • {recording ? "Enregistrement en cours…" : audioBlob ? "Réécouter puis enregistrer" : "Appuyez pour commencer"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
