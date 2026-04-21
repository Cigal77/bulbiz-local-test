import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Dossier } from "@/hooks/useDossier";
import { generateStructuredSummary } from "@/lib/summary";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, RefreshCw, Loader2, Zap, Mic, Camera, FileText, Receipt, Package, StickyNote, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";

interface SummaryBlockProps {
  dossier: Dossier;
  mediaCount?: number;
  historiqueCount?: number;
  quotesCount?: number;
}

interface MaterialItem {
  label: string;
  qty: number;
  unit?: string;
  ref?: string;
}

interface AiSummary {
  headline: string;
  bullets: string[];
  next_action: string;
  auto_filled?: string[];
  material_list?: MaterialItem[];
  media_analyzed?: { images: number; videos: number; audio: number; notes?: number; quotes?: number; invoices?: number };
  media_skipped?: { images_too_large?: number; audios_too_large?: number };
}

// Normalize a label so "Joint torique 40mm" and "Joint Torique 40 MM" merge.
function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

interface PersistedState {
  items: MaterialItem[];
  checkedKeys: string[];   // normalized labels currently checked
  deletedKeys: string[];   // normalized labels manually removed (won't be re-added by AI)
  manualKeys: string[];    // normalized labels added manually (kept even if AI doesn't return them)
}

function loadPersistedState(dossierId: string): PersistedState {
  try {
    const raw = localStorage.getItem(`material-list-${dossierId}`);
    if (!raw) return { items: [], checkedKeys: [], deletedKeys: [], manualKeys: [] };
    const parsed = JSON.parse(raw);
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      checkedKeys: Array.isArray(parsed.checkedKeys) ? parsed.checkedKeys : [],
      deletedKeys: Array.isArray(parsed.deletedKeys) ? parsed.deletedKeys : [],
      manualKeys: Array.isArray(parsed.manualKeys) ? parsed.manualKeys : [],
    };
  } catch {
    return { items: [], checkedKeys: [], deletedKeys: [], manualKeys: [] };
  }
}

function persistState(dossierId: string, state: PersistedState) {
  try {
    localStorage.setItem(`material-list-${dossierId}`, JSON.stringify(state));
  } catch { /* quota exceeded — ignore */ }
}

export function SummaryBlock({ dossier, mediaCount, historiqueCount, quotesCount }: SummaryBlockProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fallback = generateStructuredSummary(dossier);
  const initial = loadPersistedState(dossier.id);
  const [localItems, setLocalItems] = useState<MaterialItem[]>(initial.items);
  // Keys are normalized labels so checks survive list re-orderings and AI merges.
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set(initial.checkedKeys));
  const [deletedKeys, setDeletedKeys] = useState<Set<string>>(new Set(initial.deletedKeys));
  const [manualKeys, setManualKeys] = useState<Set<string>>(new Set(initial.manualKeys));
  const [showAddInput, setShowAddInput] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);
  const [forceRefresh, setForceRefresh] = useState(false);

  const {
    data: aiSummary,
    isLoading,
    isFetching,
    refetch,
    isError,
  } = useQuery<AiSummary>({
    // Stable key: the edge function has its own data fingerprint (cache hit
    // when nothing relevant changed). Re-fetching just because mediaCount/
    // historiqueCount changed forced a 30s+ AI call on every dossier open.
    queryKey: ["ai-summary", dossier.id, dossier.updated_at],
    queryFn: async () => {
      const shouldForce = forceRefresh;
      // Reset force flag after consuming it
      if (shouldForce) setForceRefresh(false);

      // 60s client-side timeout: if the edge function is stuck, we surface
      // a clear error instead of moulinant indéfiniment.
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 60_000);
      let data: any = null;
      let error: any = null;
      try {
        const res = await supabase.functions.invoke("summarize-dossier", {
          body: { dossier_id: dossier.id, force: shouldForce },
        });
        data = res.data;
        error = res.error;
      } catch (e: any) {
        error = e;
      } finally {
        clearTimeout(timer);
      }
      if (ctl.signal.aborted) {
        toast({
          title: "Enrichissement IA trop long",
          description: "Réessayez dans une minute. Le résumé basique reste affiché.",
        });
        return fallback as AiSummary;
      }

      if (error || data?.error) {
        const message = `${error?.message ?? ""} ${data?.error ?? ""}`.trim();
        console.error("[SummaryBlock] summarize-dossier failed:", { error, data });
        if (message.includes("401") || message.includes("Non authentifié")) {
          return fallback as AiSummary;
        }
        if (message.includes("402")) {
          toast({ title: "Crédits IA épuisés", description: "Rechargez vos crédits pour continuer.", variant: "destructive" });
        } else if (message.includes("429")) {
          toast({ title: "Trop de requêtes IA", description: "Réessayez dans une minute.", variant: "destructive" });
        } else {
          toast({ title: "IA indisponible", description: message || "Résumé basique affiché.", variant: "destructive" });
        }
        throw error ?? new Error(data?.error ?? "Erreur IA");
      }

      if (data?.auto_filled?.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["dossier", dossier.id] });
        queryClient.invalidateQueries({ queryKey: ["historique", dossier.id] });
      }

      return data as AiSummary;
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });

  // === MERGE (not overwrite) AI material_list with local list ===
  // - keep checked / manually-added / custom-qty items intact
  // - never re-add an item the user manually deleted
  // - add new AI-detected items at the end
  useEffect(() => {
    const aiList = aiSummary?.material_list;
    if (!aiList) return;

    setLocalItems((prev) => {
      const existingByKey = new Map<string, MaterialItem>();
      for (const it of prev) existingByKey.set(normalizeLabel(it.label), it);

      const merged: MaterialItem[] = [...prev];
      for (const aiItem of aiList) {
        const key = normalizeLabel(aiItem.label);
        if (!key) continue;
        if (deletedKeys.has(key)) continue;        // user removed it → never re-add
        if (existingByKey.has(key)) continue;      // already there → preserve user's qty/state
        merged.push(aiItem);
      }
      return merged;
    });
  }, [aiSummary?.material_list, deletedKeys]);

  // Persist whenever the list / checks / deletions / manual additions change.
  useEffect(() => {
    persistState(dossier.id, {
      items: localItems,
      checkedKeys: Array.from(checkedKeys),
      deletedKeys: Array.from(deletedKeys),
      manualKeys: Array.from(manualKeys),
    });
  }, [dossier.id, localItems, checkedKeys, deletedKeys, manualKeys]);

  // One-time toast when the backend reports media that was too large to analyze.
  const skippedShownRef = useRef(false);
  useEffect(() => {
    const skipped = aiSummary?.media_skipped;
    if (!skipped || skippedShownRef.current) return;
    const total = (skipped.images_too_large ?? 0) + (skipped.audios_too_large ?? 0);
    if (total > 0) {
      skippedShownRef.current = true;
      toast({
        title: "Média(s) trop volumineux",
        description: `${total} fichier(s) > 4 Mo ignoré(s) par l'IA. Réduis la taille avant upload pour qu'ils soient analysés.`,
      });
    }
  }, [aiSummary?.media_skipped, toast]);

  // Focus input when add mode is toggled
  useEffect(() => {
    if (showAddInput && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [showAddInput]);

  const summary = aiSummary || fallback;
  const showNextAction = aiSummary?.next_action;
  const hasAutoFilled = aiSummary?.auto_filled && aiSummary.auto_filled.length > 0;
  const mediaInfo = aiSummary?.media_analyzed;
  const hasMediaAnalyzed = mediaInfo && (mediaInfo.images > 0 || mediaInfo.audio > 0 || (mediaInfo.notes ?? 0) > 0 || (mediaInfo.quotes ?? 0) > 0 || (mediaInfo.invoices ?? 0) > 0);
  const hasMaterial = localItems.length > 0 || showAddInput;

  const toggleItem = (idx: number) => {
    const item = localItems[idx];
    if (!item) return;
    const key = normalizeLabel(item.label);
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const removeItem = (idx: number) => {
    const item = localItems[idx];
    if (!item) return;
    const key = normalizeLabel(item.label);
    setLocalItems((prev) => prev.filter((_, i) => i !== idx));
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    // Tag as deleted only if it wasn't a manual addition (manual = user owns it).
    if (!manualKeys.has(key)) {
      setDeletedKeys((prev) => new Set(prev).add(key));
    }
    setManualKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const addItem = () => {
    const label = newItemLabel.trim();
    if (!label) return;
    const key = normalizeLabel(label);
    setLocalItems((prev) => {
      // Avoid duplicates if the user types something already in the list.
      if (prev.some((it) => normalizeLabel(it.label) === key)) return prev;
      return [...prev, { label, qty: 1 }];
    });
    setManualKeys((prev) => new Set(prev).add(key));
    // If it was previously deleted, un-delete it.
    setDeletedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setNewItemLabel("");
    setShowAddInput(false);
  };

  const isChecked = (item: MaterialItem) => checkedKeys.has(normalizeLabel(item.label));

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Résumé de la demande
          {(isLoading || isFetching) && (
            <span className="inline-flex items-center gap-1 text-[9px] font-normal normal-case tracking-normal text-primary/60 ml-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              enrichissement…
            </span>
          )}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-primary/60 hover:text-primary"
          onClick={() => { setForceRefresh(true); setTimeout(() => refetch(), 0); }}
          disabled={isFetching}
          title="Régénérer le résumé IA (ignore le cache)"
        >
          {isFetching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/* Always render content immediately: fallback while AI is loading,
          then aiSummary when it arrives. No more blank "Analyse en cours…". */}
      <>
          <p className="text-sm font-semibold text-foreground">{summary.headline}</p>
          <ul className="space-y-1">
            {summary.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" />
                {b}
              </li>
            ))}
          </ul>

          {showNextAction && (
            <div className="flex items-start gap-2 rounded-lg bg-primary/10 p-3 mt-2">
              <Zap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/70 mb-0.5">
                  Action recommandée
                </p>
                <p className="text-sm font-medium text-foreground">{aiSummary!.next_action}</p>
              </div>
            </div>
          )}

          {hasMaterial && (
            <div className="rounded-lg bg-accent/30 border border-accent/50 p-3 mt-2 space-y-2">
              <div className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-primary" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/70">
                  Matériel à emporter ({localItems.length})
                </p>
                {(() => {
                  const checkedCount = localItems.filter(isChecked).length;
                  return checkedCount > 0 && localItems.length > 0 ? (
                    <span className="text-[10px] text-muted-foreground ml-auto mr-1">
                      {checkedCount}/{localItems.length} ✓
                    </span>
                  ) : null;
                })()}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-primary/60 hover:text-primary ml-auto"
                  onClick={() => setShowAddInput(true)}
                  title="Ajouter du matériel"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <ul className="space-y-1">
                {localItems.map((item, i) => {
                  const checked = isChecked(item);
                  return (
                  <li
                    key={`${normalizeLabel(item.label)}-${i}`}
                    className={`flex items-center group transition-opacity duration-150 ${checked ? "opacity-50" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleItem(i)}
                      className="flex items-center justify-center shrink-0 w-10 h-10 -ml-2 mr-1 cursor-pointer"
                      aria-label={checked ? "Décocher" : "Cocher"}
                    >
                      <span
                        className={`flex items-center justify-center w-[22px] h-[22px] rounded-full border-2 transition-all duration-150 ease-in-out ${
                          checked
                            ? "border-primary bg-primary"
                            : "border-primary/60 bg-transparent"
                        }`}
                      >
                        {checked && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-primary-foreground">
                            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                    </button>
                    <div
                      className={`flex-1 min-w-0 cursor-pointer text-sm leading-snug py-1 ${checked ? "line-through" : ""}`}
                      onClick={() => toggleItem(i)}
                    >
                      <span className="text-foreground/90">
                        {item.qty > 1 && (
                          <span className="font-medium text-primary">
                            {item.qty}{item.unit && item.unit !== "u" ? ` ${item.unit} ` : "× "}
                          </span>
                        )}
                        {item.label}
                      </span>
                      {item.ref && item.ref !== "n/a" && (
                        <span className="text-[10px] text-muted-foreground ml-1">({item.ref})</span>
                      )}
                    </div>
                    <button
                      onClick={() => removeItem(i)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0 p-1"
                      title="Supprimer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                  );
                })}
              </ul>
              {showAddInput && (
                <form
                  className="flex items-center gap-2 mt-1"
                  onSubmit={(e) => { e.preventDefault(); addItem(); }}
                >
                  <Input
                    ref={addInputRef}
                    value={newItemLabel}
                    onChange={(e) => setNewItemLabel(e.target.value)}
                    placeholder="Ajouter du matériel…"
                    className="h-7 text-sm flex-1"
                  />
                  <Button type="submit" size="sm" variant="secondary" className="h-7 px-2 text-xs" disabled={!newItemLabel.trim()}>
                    OK
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setShowAddInput(false); setNewItemLabel(""); }}>
                    ✕
                  </Button>
                </form>
              )}
            </div>
          )}

          {hasAutoFilled && (
            <div className="flex items-start gap-2 rounded-lg bg-green-500/10 border border-green-500/20 p-3 mt-2">
              <Mic className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-green-700 mb-0.5">
                  Rempli automatiquement
                </p>
                <p className="text-sm text-foreground/80">{aiSummary!.auto_filled!.join(", ")}</p>
              </div>
            </div>
          )}

          {hasMediaAnalyzed && (
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <span className="text-[10px] text-muted-foreground">Analysé :</span>
              {mediaInfo!.images > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                  <Camera className="h-3 w-3" /> {mediaInfo!.images} photo{mediaInfo!.images > 1 ? "s" : ""}
                </span>
              )}
              {mediaInfo!.audio > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                  <Mic className="h-3 w-3" /> {mediaInfo!.audio} vocal{mediaInfo!.audio > 1 ? "es" : "e"}
                </span>
              )}
              {(mediaInfo!.notes ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                  <StickyNote className="h-3 w-3" /> {mediaInfo!.notes} note{mediaInfo!.notes! > 1 ? "s" : ""}
                </span>
              )}
              {(mediaInfo!.quotes ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                  <FileText className="h-3 w-3" /> {mediaInfo!.quotes} devis
                </span>
              )}
              {(mediaInfo!.invoices ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                  <Receipt className="h-3 w-3" /> {mediaInfo!.invoices} facture{mediaInfo!.invoices! > 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}

          {isError && !aiSummary && (
            <p className="text-[10px] text-muted-foreground italic">Résumé basique affiché (IA indisponible)</p>
          )}
        </>
    </div>
  );
}
