import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Sparkles, Check, AlertTriangle, Info, PackageCheck, Bot, RefreshCw, Undo2,
  Mic, Image as ImageIcon, FileText, History, Camera,
} from "lucide-react";
import { useAiQuoteDraft } from "@/hooks/useAiQuoteDraft";
import { aiLineToQuoteItem, type AiQuoteLine, type AiQuoteDraft } from "@/lib/ai-quote-types";
import type { QuoteItem } from "@/lib/quote-types";
import { cn } from "@/lib/utils";
import { VoiceRecorderDialog } from "@/components/dossier/VoiceRecorderDialog";

interface AiQuoteDraftPanelProps {
  dossierId: string;
  quoteId?: string | null;
  autoGenerate?: boolean;
  onAddItem: (item: Omit<QuoteItem, "id">) => void;
  onAddItems: (items: Omit<QuoteItem, "id">[]) => void;
  /** Retirer une ligne IA du devis (par ai_ref). Si non fournie, mode "ajout simple" sans bouton retirer. */
  onRemoveAiLine?: (aiRef: string) => void;
  /** Retirer toutes les lignes IA du devis. */
  onRemoveAllAi?: () => void;
  /** ai_ref actuellement présents dans le devis — pour afficher le bon état (ajoutée vs retirée). */
  presentAiRefs?: string[];
  /** Quand cette clé change, relance une nouvelle génération (utilisé par le bouton "Pré-devis IA" du header). */
  triggerKey?: number;
}

export function AiQuoteDraftPanel({
  dossierId,
  quoteId,
  autoGenerate,
  onAddItem,
  onAddItems,
  onRemoveAiLine,
  onRemoveAllAi,
  presentAiRefs,
  triggerKey,
}: AiQuoteDraftPanelProps) {
  const { draft, isGenerating, generate, generateFromVoice, logDecision, reset } = useAiQuoteDraft();
  const [hasAutoTriggered, setHasAutoTriggered] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  // ai_ref injectés au moins une fois pendant la session courante (évite double-injection sur re-render).
  const [injectedRefs, setInjectedRefs] = useState<Set<string>>(new Set());
  // ai_ref retirés manuellement par l'artisan — ne pas les ré-injecter automatiquement.
  const [removedRefs, setRemovedRefs] = useState<Set<string>>(new Set());

  // Rotating loading message while IA works
  useEffect(() => {
    if (!isGenerating) return;
    setLoadingStep(0);
    const id = window.setInterval(() => setLoadingStep((s) => (s + 1) % 4), 1500);
    return () => window.clearInterval(id);
  }, [isGenerating]);

  const handleVoiceSave = async (blob: Blob) => {
    setVoiceOpen(false);
    setInjectedRefs(new Set());
    setRemovedRefs(new Set());
    await generateFromVoice(dossierId, blob, quoteId);
  };

  // Auto-trigger once on mount if requested
  useEffect(() => {
    if (autoGenerate && !hasAutoTriggered && !draft && !isGenerating) {
      setHasAutoTriggered(true);
      generate(dossierId, quoteId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate, hasAutoTriggered, draft, isGenerating, dossierId, quoteId]);

  // Re-trigger when triggerKey changes (bouton "Pré-devis IA" du header)
  useEffect(() => {
    if (triggerKey === undefined || triggerKey === 0) return;
    if (isGenerating) return;
    setInjectedRefs(new Set());
    setRemovedRefs(new Set());
    reset();
    generate(dossierId, quoteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerKey]);

  // ===== Auto-injection : dès que le draft est reçu, toutes les lignes sont
  // automatiquement ajoutées au devis. L'artisan édite ensuite directement les
  // lignes (qté, PU, TVA, remise) via les contrôles standards des sections.
  useEffect(() => {
    if (!draft?.lines?.length) return;
    const newOnes = draft.lines.filter(
      (l) => !injectedRefs.has(l.ref) && !removedRefs.has(l.ref),
    );
    if (newOnes.length === 0) return;
    onAddItems(newOnes.map(aiLineToQuoteItem));
    setInjectedRefs((prev) => {
      const next = new Set(prev);
      newOnes.forEach((l) => next.add(l.ref));
      return next;
    });
    newOnes.forEach((l) => logDecision(draft.log_id, l.ref, "accepted"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.log_id]);

  const handleRemoveLine = (line: AiQuoteLine) => {
    onRemoveAiLine?.(line.ref);
    setRemovedRefs((prev) => new Set(prev).add(line.ref));
    setInjectedRefs((prev) => {
      const next = new Set(prev);
      next.delete(line.ref);
      return next;
    });
    if (draft) logDecision(draft.log_id, line.ref, "rejected");
  };

  const handleRestoreLine = (line: AiQuoteLine) => {
    setRemovedRefs((prev) => {
      const next = new Set(prev);
      next.delete(line.ref);
      return next;
    });
    onAddItem(aiLineToQuoteItem(line));
    setInjectedRefs((prev) => new Set(prev).add(line.ref));
    if (draft) logDecision(draft.log_id, line.ref, "accepted");
  };

  const handleRemoveAll = (d: AiQuoteDraft) => {
    onRemoveAllAi?.();
    setRemovedRefs(new Set(d.lines.map((l) => l.ref)));
    setInjectedRefs(new Set());
    logDecision(d.log_id, null, "rejected");
  };

  const handleRegenerate = () => {
    onRemoveAllAi?.();
    setInjectedRefs(new Set());
    setRemovedRefs(new Set());
    generate(dossierId, quoteId, { force: true });
  };

  // ===== Empty / Initial state =====
  if (!draft && !isGenerating) {
    return (
      <div className="flex flex-col h-full gap-3">
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 gap-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Pré-devis IA</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
              L'IA analyse <strong>tout le dossier</strong> : notes vocales, photos, notes écrites, échanges, infos client et historique.
            </p>
          </div>
          <Button onClick={() => generate(dossierId, quoteId)} className="gap-2 w-full max-w-[280px]">
            <Sparkles className="h-4 w-4" />
            Générer à partir du dossier
          </Button>
          <Button
            variant="outline"
            onClick={() => setVoiceOpen(true)}
            className="gap-2 w-full max-w-[280px]"
          >
            <Mic className="h-4 w-4" />
            Dicter un pré-devis vocal
          </Button>
          <p className="text-[10px] text-muted-foreground italic max-w-[280px]">
            Le mode vocal combine ta dictée avec l'analyse complète du dossier (photos, notes…).
          </p>
        </div>
        <VoiceRecorderDialog open={voiceOpen} onClose={() => setVoiceOpen(false)} onSave={handleVoiceSave} />
      </div>
    );
  }

  // ===== Loading =====
  if (isGenerating) {
    const steps = [
      "Lecture des photos du chantier…",
      "Écoute des notes vocales…",
      "Comparaison aux devis passés…",
      "Synthèse du pré-devis…",
    ];
    return (
      <div className="flex flex-col h-full gap-3 px-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Bot className="h-4 w-4 text-primary" />
          <span>L'IA analyse le dossier</span>
          <span className="inline-flex items-end gap-0.5 ml-0.5">
            <span className="h-1 w-1 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="h-1 w-1 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="h-1 w-1 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: "300ms" }} />
          </span>
        </div>
        <p key={loadingStep} className="text-[10px] text-primary/80 italic px-1 transition-opacity">
          {steps[loadingStep]}
        </p>
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
    );
  }

  if (!draft) return null;

  const confidencePct = Math.round(draft.confidence * 100);
  const confidenceColor =
    confidencePct >= 75 ? "bg-success/15 text-success" :
    confidencePct >= 50 ? "bg-warning/15 text-warning" :
    "bg-destructive/15 text-destructive";

  return (
    <ScrollArea className="h-full pr-2">
      <div className="space-y-3 pb-4">
        {/* Header */}
        <div className="rounded-lg border bg-primary/5 p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-foreground line-clamp-2">{draft.title}</h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{draft.summary}</p>
            </div>
            <Badge variant="secondary" className={cn("shrink-0 text-[10px]", confidenceColor)}>
              {confidencePct}%
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <PackageCheck className="h-3 w-3" />
            {draft.catalog_match_count} catalogue · {draft.ai_fallback_count} estimations IA
          </div>
          {draft.analysis_sources && (
            <div className="flex flex-wrap gap-1 pt-1 border-t border-border/40">
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider w-full">
                Analyse basée sur :
              </span>
              {draft.analysis_sources.audio_count > 0 && (
                <Badge variant="secondary" className="h-4 text-[9px] px-1.5 gap-0.5">
                  <Mic className="h-2.5 w-2.5" />
                  {draft.analysis_sources.audio_count} voix{draft.analysis_sources.dossier_voice_transcripts_count
                    ? ` (${draft.analysis_sources.dossier_voice_transcripts_count} transcrite${draft.analysis_sources.dossier_voice_transcripts_count > 1 ? "s" : ""})`
                    : ""}
                </Badge>
              )}
              {draft.analysis_sources.image_count > 0 && (
                <Badge variant="secondary" className="h-4 text-[9px] px-1.5 gap-0.5">
                  <ImageIcon className="h-2.5 w-2.5" />
                  {draft.analysis_sources.image_count} photo{draft.analysis_sources.image_count > 1 ? "s" : ""}
                </Badge>
              )}
              {(draft.analysis_sources.written_note_count + draft.analysis_sources.historic_note_count) > 0 && (
                <Badge variant="secondary" className="h-4 text-[9px] px-1.5 gap-0.5">
                  <FileText className="h-2.5 w-2.5" />
                  {draft.analysis_sources.written_note_count + draft.analysis_sources.historic_note_count} note(s)
                </Badge>
              )}
              {draft.analysis_sources.past_quote_count > 0 && (
                <Badge variant="secondary" className="h-4 text-[9px] px-1.5 gap-0.5">
                  <History className="h-2.5 w-2.5" />
                  {draft.analysis_sources.past_quote_count} devis passés
                </Badge>
              )}
              {draft.analysis_sources.voice_transcript_used && (
                <Badge className="h-4 text-[9px] px-1.5 gap-0.5 bg-primary/15 text-primary">
                  <Mic className="h-2.5 w-2.5" />
                  Dictée vocale
                </Badge>
              )}
              {draft.analysis_sources.audio_count === 0 &&
                draft.analysis_sources.image_count === 0 &&
                draft.analysis_sources.written_note_count === 0 &&
                draft.analysis_sources.historic_note_count === 0 && (
                  <span className="text-[9px] text-warning">Aucune note ni photo trouvée — enrichis le dossier pour un devis plus précis.</span>
                )}
            </div>
          )}
          {draft.voice_transcript && (
            <div className="rounded border border-primary/20 bg-primary/5 p-2 mt-1">
              <p className="text-[9px] uppercase tracking-wider text-primary font-semibold mb-1">
                Dictée vocale prise en compte
              </p>
              <p className="text-[10px] text-foreground italic line-clamp-3">"{draft.voice_transcript}"</p>
            </div>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground italic px-1">
          Proposition générée à partir du dossier. Vérifie et ajuste avant envoi.
        </p>

        {/* Matériel détecté sur les photos */}
        {draft.detected_from_photos && draft.detected_from_photos.length > 0 && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Camera className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                Matériel identifié sur les photos ({draft.detected_from_photos.length})
              </span>
            </div>
            <ul className="space-y-1">
              {draft.detected_from_photos.map((p, i) => (
                <li key={i} className="text-[10px] text-foreground leading-snug">
                  <span className="font-semibold">{p.material_label}</span>
                  {p.brand && <span className="text-muted-foreground"> · {p.brand}</span>}
                  {p.model_or_ref && <span className="text-muted-foreground"> · ref {p.model_or_ref}</span>}
                  {p.dimensions && <span className="text-muted-foreground"> · {p.dimensions}</span>}
                  <span className="block text-[9px] text-muted-foreground italic">
                    📷 {p.photo_name} — {p.visible_state}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Bandeau warning si photos présentes mais aucune détection */}
        {draft.analysis_sources &&
          draft.analysis_sources.image_count > 0 &&
          (!draft.detected_from_photos || draft.detected_from_photos.length === 0) && (
            <Alert className="border-warning/40 bg-warning/5">
              <Camera className="h-4 w-4 text-warning" />
              <AlertDescription className="text-xs text-muted-foreground">
                Photos peu lisibles — ajoute une photo plus nette du matériel pour une meilleure détection.
              </AlertDescription>
            </Alert>
          )}

        {/* Missing questions */}
        {draft.missing_questions?.length > 0 && (
          <Alert className="border-warning/40 bg-warning/5">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-xs space-y-1">
              <strong className="block text-warning">Infos manquantes</strong>
              <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                {draft.missing_questions.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Lines */}
        {draft.lines.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Lignes ajoutées ({draft.lines.length - removedRefs.size}/{draft.lines.length})
              </span>
              {onRemoveAllAi && draft.lines.length - removedRefs.size > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1 text-muted-foreground"
                  onClick={() => handleRemoveAll(draft)}
                >
                  <Undo2 className="h-3 w-3" /> Tout retirer
                </Button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground italic px-1">
              Toutes les lignes sont déjà dans le devis. Modifie qté, prix, TVA et description directement dans les sections.
            </p>

            {draft.lines.map((line) => {
              const isRemoved = removedRefs.has(line.ref);
              const isPresent = presentAiRefs ? presentAiRefs.includes(line.ref) : !isRemoved;
              return (
                <div
                  key={line.ref}
                  className={cn(
                    "rounded-md border bg-background px-2.5 py-2 transition-all",
                    isRemoved && "border-dashed opacity-60",
                    !isRemoved && isPresent && "border-success/30 bg-success/[0.03]",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        {!isRemoved && isPresent && (
                          <Check className="h-3 w-3 text-success shrink-0" />
                        )}
                        <p className={cn(
                          "text-xs font-semibold text-foreground line-clamp-1 flex-1 min-w-0",
                          isRemoved && "line-through text-muted-foreground",
                        )}>
                          {line.label}
                        </p>
                        <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
                          {line.source === "catalog" ? "Cat." : "IA"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                        <span>{line.qty} {line.unit}</span>
                        <span>×</span>
                        <span className="font-medium text-foreground">{line.unit_price.toFixed(2)} €</span>
                        <span>· TVA {line.vat_rate}%</span>
                      </div>
                      {line.voice_evidence && (
                        <p className="text-[9px] text-primary italic flex items-start gap-1 mt-1">
                          <Mic className="h-2.5 w-2.5 mt-px shrink-0" />
                          <span className="line-clamp-2">« {line.voice_evidence} »</span>
                        </p>
                      )}
                      {line.rationale && !line.voice_evidence && (
                        <p className="text-[9px] text-muted-foreground italic flex items-start gap-1 mt-0.5">
                          <Info className="h-2.5 w-2.5 mt-px shrink-0" />
                          <span className="line-clamp-2">{line.rationale}</span>
                        </p>
                      )}
                    </div>
                    {onRemoveAiLine && (
                      isRemoved ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[10px] gap-1 px-2 shrink-0"
                          onClick={() => handleRestoreLine(line)}
                          title="Réajouter au devis"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Remettre
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[10px] gap-1 px-2 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveLine(line)}
                          title="Retirer cette ligne du devis"
                        >
                          <Undo2 className="h-3 w-3" />
                          Retirer
                        </Button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Variants */}
        {draft.variants?.length > 0 && (
          <div className="space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
              Variantes ({draft.variants.length})
            </span>
            {draft.variants.map((v, i) => (
              <div key={i} className="rounded-lg border border-dashed p-2.5 space-y-2 bg-muted/30">
                <div>
                  <p className="text-xs font-semibold text-foreground">{v.label}</p>
                  {v.description && <p className="text-[10px] text-muted-foreground">{v.description}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">{v.lines.length} ligne(s)</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-xs gap-1"
                  onClick={() => onAddItems(v.lines.map(aiLineToQuoteItem))}
                >
                  <Check className="h-3 w-3" />
                  Appliquer cette variante
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Assumptions */}
        {draft.assumptions?.length > 0 && (
          <div className="rounded-lg border bg-muted/30 p-2.5 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Hypothèses
            </span>
            <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-muted-foreground">
              {draft.assumptions.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handleRegenerate}>
            <RefreshCw className="h-3 w-3" />
            Régénérer
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setVoiceOpen(true)}>
            <Mic className="h-3 w-3" />
            Vocal
          </Button>
        </div>
      </div>
      <VoiceRecorderDialog open={voiceOpen} onClose={() => setVoiceOpen(false)} onSave={handleVoiceSave} />
    </ScrollArea>
  );
}
