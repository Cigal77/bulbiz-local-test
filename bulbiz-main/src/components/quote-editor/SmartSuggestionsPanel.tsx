import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Plus, EyeOff, Sparkles, Wrench, Package, Hammer, Lightbulb, History } from "lucide-react";
import { useSmartSuggestions, type SmartSuggestion, type SuggestionBucket } from "@/hooks/useSmartSuggestions";
import { useSuggestionPreferences, signatureFor } from "@/hooks/useSuggestionPreferences";
import { useInterventionDetection } from "@/hooks/useInterventionDetection";
import type { QuoteItem } from "@/lib/quote-types";
import { cn } from "@/lib/utils";

interface Props {
  dossierId: string;
  dossierCategory?: string | null;
  dossierDescription?: string | null;
  dossierProblemTypes?: string[] | null;
  currentItems: { label?: string | null; id?: string }[];
  onAddItem: (item: Omit<QuoteItem, "id">) => void;
  onAddItems: (items: Omit<QuoteItem, "id">[]) => void;
}

const BUCKETS: { key: SuggestionBucket; label: string; icon: typeof Wrench; defaultOpen: boolean }[] = [
  { key: "essential", label: "Indispensables", icon: Wrench, defaultOpen: true },
  { key: "frequent", label: "Souvent ajoutés", icon: Sparkles, defaultOpen: true },
  { key: "habit", label: "Tes habitudes", icon: History, defaultOpen: true },
  { key: "consumable", label: "Consommables", icon: Package, defaultOpen: false },
  { key: "labor_travel", label: "Main-d'œuvre & déplacement", icon: Hammer, defaultOpen: false },
  { key: "option", label: "Options", icon: Lightbulb, defaultOpen: false },
];

function toQuoteItem(s: SmartSuggestion): Omit<QuoteItem, "id"> {
  // Map manoeuvre/bundle item_type -> QuoteItemType
  const t = (s.type ?? "").toLowerCase();
  let qType: QuoteItem["type"] = "standard";
  if (t === "main_oeuvre" || t === "labor") qType = "main_oeuvre";
  else if (t === "deplacement" || t === "travel") qType = "deplacement";
  else if (t === "consommable" || t === "consumable" || t === "fourniture") qType = "fourniture";
  else if (t === "materiel" || t === "material") qType = "materiel";

  return {
    label: s.label,
    description: s.description ?? "",
    qty: s.default_qty || 1,
    unit: s.unit || "u",
    unit_price: s.unit_price || 0,
    vat_rate: s.vat_rate ?? 10,
    discount: 0,
    type: qType,
  };
}

export function SmartSuggestionsPanel({
  dossierCategory,
  dossierDescription,
  dossierProblemTypes,
  currentItems,
  onAddItem,
  onAddItems,
}: Props) {
  const detection = useInterventionDetection({
    category: dossierCategory ?? null,
    description: dossierDescription ?? null,
    problem_types: dossierProblemTypes ?? null,
  });
  const detected = detection.data?.[0];

  const excludeSignatures = useMemo(() => {
    const set = new Set<string>();
    for (const it of currentItems) {
      const k = (it.label ?? "").trim().toLowerCase();
      if (k) {
        set.add(`man:${k}`);
        set.add(`bun:${k}`);
        set.add(`usr:${k}`);
      }
    }
    return set;
  }, [currentItems]);

  const { data: suggestions = [], isLoading } = useSmartSuggestions({
    interventionId: detected?.id ?? null,
    dossierCategory,
    excludeSignatures,
  });

  const prefs = useSuggestionPreferences(detected?.id ?? null);

  const grouped = useMemo(() => {
    const m = new Map<SuggestionBucket, SmartSuggestion[]>();
    for (const b of BUCKETS) m.set(b.key, []);
    for (const s of suggestions) {
      if (prefs.isHidden({ id: s.material_id ?? undefined, label: s.label })) continue;
      m.get(s.bucket)?.push(s);
    }
    return m;
  }, [suggestions, prefs]);

  const essentials = grouped.get("essential") ?? [];

  const handleAddAllEssentials = () => {
    if (essentials.length === 0) return;
    onAddItems(essentials.map(toQuoteItem));
  };

  if (!detected && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8 gap-2">
        <Sparkles className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium">Pas encore d'intervention détectée</p>
        <p className="text-xs text-muted-foreground max-w-[260px]">
          Ajoute une catégorie ou une description au dossier pour activer les suggestions intelligentes.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {detected && (
        <div className="rounded-lg border bg-primary/5 px-3 py-2 flex items-start gap-2">
          <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Intervention détectée
            </p>
            <p className="text-sm font-semibold truncate">{detected.label}</p>
            {detected.parent_label && (
              <p className="text-[11px] text-muted-foreground truncate">{detected.parent_label}</p>
            )}
          </div>
          {essentials.length > 0 && (
            <Button size="sm" variant="default" className="h-7 text-xs shrink-0" onClick={handleAddAllEssentials}>
              <Plus className="h-3 w-3" />
              Tout ({essentials.length})
            </Button>
          )}
        </div>
      )}

      <ScrollArea className="flex-1 -mx-1 px-1">
        <div className="space-y-2 pr-1">
          {BUCKETS.map((bucket) => {
            const list = grouped.get(bucket.key) ?? [];
            if (list.length === 0) return null;
            const Icon = bucket.icon;
            return (
              <Collapsible key={bucket.key} defaultOpen={bucket.defaultOpen}>
                <CollapsibleTrigger
                  className={cn(
                    "w-full flex items-center justify-between gap-2 py-1.5 px-2 rounded-md",
                    "hover:bg-muted/60 group text-left",
                  )}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wider truncate">{bucket.label}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      {list.length}
                    </Badge>
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-1">
                  <div className="space-y-1">
                    {list.map((s) => (
                      <SuggestionRow
                        key={s.signature}
                        item={s}
                        onAdd={() => onAddItem(toQuoteItem(s))}
                        onHide={() => prefs.hide.mutate({ id: s.material_id ?? undefined, label: s.label })}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}

          {!isLoading && suggestions.length === 0 && (
            <div className="text-center py-6 text-xs text-muted-foreground">
              Aucune suggestion pour cette intervention.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function SuggestionRow({
  item,
  onAdd,
  onHide,
}: {
  item: SmartSuggestion;
  onAdd: () => void;
  onHide: () => void;
}) {
  return (
    <div className="flex items-start gap-2 py-1.5 px-2 rounded-md hover:bg-muted/40 group transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight truncate">{item.label}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
            {item.default_qty} {item.unit}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
            {item.unit_price}€
          </Badge>
          {item.usage_count_user && item.usage_count_user >= 3 && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
              ×{item.usage_count_user}
            </Badge>
          )}
          {item.origin_label && (
            <span className="text-[10px] text-muted-foreground truncate">{item.origin_label}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={onHide}
          title="Masquer cette suggestion"
        >
          <EyeOff className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="default" className="h-7 w-7" onClick={onAdd} title="Ajouter au devis">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
