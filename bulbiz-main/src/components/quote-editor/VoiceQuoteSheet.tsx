import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Mic, Square, RefreshCw, X, Check, Sparkles, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceQuoteCommand } from "@/hooks/useVoiceQuoteCommand";
import { VoiceCommandActionCard } from "./VoiceCommandActionCard";
import type { VoiceMode, VoiceAction } from "@/lib/voice-quote-types";
import type { QuoteItem } from "@/lib/quote-types";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string | null;
  items: QuoteItem[];
  onApplyActions: (actions: VoiceAction[], transcript: string) => void;
}

const STORAGE_KEY = "bulbiz_voice_quote_mode";

export function VoiceQuoteSheet({ open, onOpenChange, quoteId, items, onApplyActions }: Props) {
  const { toast } = useToast();
  const [mode, setMode] = useState<VoiceMode>(() => {
    if (typeof window === "undefined") return "command";
    return (localStorage.getItem(STORAGE_KEY) as VoiceMode) || "command";
  });
  const [editedTranscript, setEditedTranscript] = useState("");

  const {
    state,
    duration,
    error,
    result,
    setResult,
    startRecording,
    stopRecording,
    reset,
    reinterpret,
  } = useVoiceQuoteCommand({ quoteId, items, mode });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    if (result?.transcript) setEditedTranscript(result.transcript);
  }, [result?.transcript]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const toggleAction = (actionId: string, accepted: boolean) => {
    if (!result) return;
    setResult({
      ...result,
      actions: result.actions.map((a) => (a.id === actionId ? { ...a, accepted } : a)),
    });
  };

  const acceptedCount = result?.actions.filter((a) => a.accepted).length ?? 0;

  const handleApply = () => {
    if (!result) return;
    const accepted = result.actions.filter((a) => a.accepted);
    if (accepted.length === 0) {
      toast({ title: "Aucune action sélectionnée", variant: "destructive" });
      return;
    }
    onApplyActions(accepted, editedTranscript || result.transcript);
    onOpenChange(false);
  };

  const examples = [
    "Ajoute deux heures de main d'œuvre",
    "Supprime la ligne déplacement",
    "Passe la quantité à 3",
    "Mets une remise de 30 euros",
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[92vh] sm:h-[85vh] flex flex-col p-0 gap-0 sm:max-w-2xl sm:mx-auto sm:rounded-t-2xl"
      >
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Devis vocal
          </SheetTitle>
          <SheetDescription className="text-xs">
            {state === "ready_to_validate"
              ? "Vérifie avant d'appliquer. Tu peux décocher chaque action."
              : "Décris une intervention ou donne une commande."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Mode toggle */}
          {(state === "idle" || state === "error") && (
            <div className="flex gap-2 mb-6">
              <Button
                size="sm"
                variant={mode === "command" ? "default" : "outline"}
                onClick={() => setMode("command")}
                className="flex-1"
              >
                Commande
              </Button>
              <Button
                size="sm"
                variant={mode === "dictation" ? "default" : "outline"}
                onClick={() => setMode("dictation")}
                className="flex-1"
              >
                Dictée libre
              </Button>
            </div>
          )}

          {/* IDLE / ERROR */}
          {(state === "idle" || state === "error") && (
            <div className="flex flex-col items-center text-center py-6">
              <button
                onClick={startRecording}
                aria-label="Démarrer l'enregistrement vocal"
                className={cn(
                  "h-24 w-24 rounded-full bg-primary text-primary-foreground shadow-lg",
                  "flex items-center justify-center",
                  "hover:bg-primary/90 active:scale-95 transition-all",
                  "ring-4 ring-primary/20 hover:ring-primary/30",
                )}
              >
                <Mic className="h-10 w-10" />
              </button>
              <p className="text-sm font-medium text-foreground mt-4">Appuie pour parler</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                {mode === "command"
                  ? "Donne une commande explicite (ajoute, supprime, modifie...)"
                  : "Décris librement l'intervention, l'IA crée les lignes"}
              </p>
              {error && (
                <div className="flex items-start gap-2 mt-4 p-3 rounded-md bg-destructive/10 text-destructive text-xs max-w-sm">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="text-left">{error}</span>
                </div>
              )}
              <div className="mt-6 w-full">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Exemples</p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {examples.map((ex) => (
                    <span
                      key={ex}
                      className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground"
                    >
                      « {ex} »
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* LISTENING */}
          {state === "listening" && (
            <div className="flex flex-col items-center text-center py-6">
              <button
                onClick={stopRecording}
                aria-label="Arrêter l'enregistrement"
                className={cn(
                  "h-24 w-24 rounded-full bg-destructive text-destructive-foreground shadow-lg",
                  "flex items-center justify-center animate-pulse",
                )}
              >
                <Square className="h-9 w-9 fill-current" />
              </button>
              <div className="text-3xl font-mono tabular-nums text-foreground mt-4">
                {formatTime(duration)}
              </div>
              <div className="flex items-center gap-1 h-6 mt-3">
                {[...Array(7)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-destructive rounded-full animate-pulse"
                    style={{
                      height: `${10 + Math.random() * 16}px`,
                      animationDelay: `${i * 0.12}s`,
                    }}
                  />
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-3">J'écoute…</p>
              <Button variant="outline" size="lg" onClick={stopRecording} className="mt-6 gap-2">
                <Square className="h-4 w-4" />
                Stop
              </Button>
            </div>
          )}

          {/* TRANSCRIBING / INTERPRETING */}
          {(state === "transcribing" || state === "interpreting") && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-center text-muted-foreground animate-pulse">
                {state === "transcribing" ? "Je transcris ta voix…" : "Je comprends ce que tu dis…"}
              </p>
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-3/4 rounded-lg" />
            </div>
          )}

          {/* READY TO VALIDATE */}
          {state === "ready_to_validate" && result && (
            <div className="space-y-4">
              {/* Editable transcript */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Transcription (modifiable)
                </label>
                <Textarea
                  value={editedTranscript}
                  onChange={(e) => setEditedTranscript(e.target.value)}
                  className="text-sm min-h-[60px]"
                />
                {editedTranscript !== result.transcript && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reinterpret(editedTranscript)}
                    className="mt-2 gap-2 h-8"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Re-interpréter
                  </Button>
                )}
              </div>

              {/* Ambiguities */}
              {result.ambiguities.length > 0 && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
                  {result.ambiguities.map((amb, i) => (
                    <div key={i} className="text-xs">
                      <div className="flex items-start gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        {amb.question}
                      </div>
                      <p className="text-muted-foreground mt-1 ml-5">
                        Candidats : {amb.candidates.map((c) => c.label).join(" / ")}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Actions comprises ({result.actions.length})
                  </p>
                  {acceptedCount !== result.actions.length && (
                    <span className="text-xs text-muted-foreground">{acceptedCount} sélectionnées</span>
                  )}
                </div>
                {result.actions.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                    Je n'ai pas compris d'action. Reformule ?
                  </div>
                ) : (
                  <div className="space-y-2">
                    {result.actions.map((a) => (
                      <VoiceCommandActionCard
                        key={a.id}
                        action={a}
                        items={items}
                        onToggle={(accepted) => toggleAction(a.id, accepted)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {result.unmatched && (
                <p className="text-[11px] text-muted-foreground italic">
                  Non compris : {result.unmatched}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Sticky footer */}
        {state === "ready_to_validate" && result && (
          <div className="border-t bg-background p-3 flex gap-2 shrink-0">
            <Button variant="ghost" size="lg" onClick={reset} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Recommencer
            </Button>
            <Button variant="ghost" size="lg" onClick={() => onOpenChange(false)} className="gap-1">
              <X className="h-4 w-4" />
              Annuler
            </Button>
            <Button
              size="lg"
              onClick={handleApply}
              disabled={acceptedCount === 0}
              className="flex-1 gap-2"
            >
              <Check className="h-4 w-4" />
              Appliquer ({acceptedCount})
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
