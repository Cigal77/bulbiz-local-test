import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type {
  VoiceMode,
  VoiceState,
  VoiceQuoteResult,
} from "@/lib/voice-quote-types";
import type { QuoteItem } from "@/lib/quote-types";

const MAX_DURATION = 120; // 2 min hard cap

interface UseVoiceQuoteCommandArgs {
  quoteId: string | null;
  items: QuoteItem[];
  mode: VoiceMode;
}

export function useVoiceQuoteCommand({ quoteId, items, mode }: UseVoiceQuoteCommandArgs) {
  const { toast } = useToast();
  const [state, setState] = useState<VoiceState>("idle");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VoiceQuoteResult | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const mimeRef = useRef<string>("audio/webm");

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.split(",")[1] ?? "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const transcribe = useCallback(
    async (blob: Blob) => {
      setState("transcribing");
      try {
        const base64 = await blobToBase64(blob);
        setState("interpreting");
        const { data, error: invokeError } = await supabase.functions.invoke(
          "voice-quote-command",
          {
            body: {
              audio_base64: base64,
              mime_type: mimeRef.current,
              quote_id: quoteId,
              mode,
              current_lines: items.map((i) => ({
                id: i.id,
                label: i.label,
                qty: i.qty,
                unit_price: i.unit_price,
                vat_rate: i.vat_rate,
                type: i.type,
              })),
            },
          },
        );
        if (invokeError) throw invokeError;
        if (data?.error === "payment_required") {
          toast({
            title: "Crédits IA épuisés",
            description: "Rechargez votre solde pour continuer.",
            variant: "destructive",
          });
          setState("error");
          setError("Crédits IA épuisés");
          return;
        }
        if (data?.error === "rate_limited") {
          toast({
            title: "Trop de requêtes",
            description: "Réessayez dans 1 minute.",
            variant: "destructive",
          });
          setState("error");
          setError("Rate limited");
          return;
        }
        if (data?.error) throw new Error(data.error);

        setResult(data as VoiceQuoteResult);
        setState("ready_to_validate");
      } catch (e) {
        console.error("Voice transcription failed:", e);
        const msg = e instanceof Error ? e.message : "Erreur d'interprétation";
        setError(msg);
        setState("error");
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      }
    },
    [items, mode, quoteId, toast],
  );

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (recorderRef.current && recorderRef.current.state === "recording") {
      try {
        recorderRef.current.stop();
      } catch (e) {
        console.warn(e);
      }
    }
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(40);
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setResult(null);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";
      mimeRef.current = mime;

      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size < 1000) {
          setError("Audio trop court. Réessayez.");
          setState("error");
          return;
        }
        await transcribe(blob);
      };
      recorder.onerror = () => {
        cleanup();
        setError("Erreur d'enregistrement");
        setState("error");
      };

      recorderRef.current = recorder;
      recorder.start(500);
      startedAtRef.current = Date.now();
      setDuration(0);
      setState("listening");
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(50);
      }

      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setDuration(elapsed);
        if (elapsed >= MAX_DURATION) {
          stopRecording();
        }
      }, 250);
    } catch (e: unknown) {
      cleanup();
      const err = e as { name?: string };
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setError("Accès au micro refusé. Autorisez-le dans les paramètres du navigateur.");
      } else if (err?.name === "NotFoundError") {
        setError("Aucun micro détecté.");
      } else {
        setError("Impossible de démarrer l'enregistrement.");
      }
      setState("error");
    }
  }, [cleanup, stopRecording, transcribe]);

  const reset = useCallback(() => {
    cleanup();
    setState("idle");
    setDuration(0);
    setError(null);
    setResult(null);
  }, [cleanup]);

  const reinterpret = useCallback(
    async (correctedTranscript: string) => {
      if (!result) return;
      setState("interpreting");
      try {
        const { data, error: invokeError } = await supabase.functions.invoke(
          "voice-quote-command",
          {
            body: {
              audio_base64: "",
              mime_type: "text/plain",
              quote_id: quoteId,
              mode,
              current_lines: items.map((i) => ({
                id: i.id,
                label: i.label,
                qty: i.qty,
                unit_price: i.unit_price,
                vat_rate: i.vat_rate,
                type: i.type,
              })),
              text_override: correctedTranscript,
            },
          },
        );
        if (invokeError) throw invokeError;
        if (data?.error) throw new Error(data.error);
        setResult({ ...(data as VoiceQuoteResult), transcript: correctedTranscript });
        setState("ready_to_validate");
      } catch (e) {
        console.error(e);
        toast({
          title: "Re-interprétation impossible",
          description: "Réessayez avec la voix.",
          variant: "destructive",
        });
        setState("ready_to_validate");
      }
    },
    [items, mode, quoteId, result, toast],
  );

  return {
    state,
    duration,
    error,
    result,
    setResult,
    startRecording,
    stopRecording,
    reset,
    reinterpret,
  };
}
