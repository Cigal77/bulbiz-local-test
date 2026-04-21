import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Plus, X, ChevronDown, ChevronUp, Wrench, Truck, Trash2 } from "lucide-react";
import {
  useInterventionTypes,
  useInterventionPack,
  detectInterventionType,
  type PackLine,
} from "@/hooks/useInterventionTypes";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface InterventionSuggestionsPanelProps {
  /** Texte combiné dossier (description + types problème) pour détection */
  contextText: string;
  /** Callback quand l'artisan ajoute des lignes au devis */
  onAddLines: (lines: PackLine[]) => void;
}

type LineGroup = "required" | "often" | "optional" | "labor" | "travel" | "waste";

const GROUP_LABELS: Record<LineGroup, { label: string; icon: any; color: string }> = {
  required: { label: "Matériel principal", icon: Sparkles, color: "text-primary" },
  often: { label: "Souvent ajouté avec", icon: Plus, color: "text-blue-600" },
  optional: { label: "Optionnel", icon: ChevronDown, color: "text-muted-foreground" },
  labor: { label: "Main d'œuvre", icon: Wrench, color: "text-orange-600" },
  travel: { label: "Déplacement", icon: Truck, color: "text-purple-600" },
  waste: { label: "Évacuation déchets", icon: Trash2, color: "text-green-600" },
};

export function InterventionSuggestionsPanel({ contextText, onAddLines }: InterventionSuggestionsPanelProps) {
  const { data: interventions = [], isLoading: loadingTypes } = useInterventionTypes();
  const detected = detectInterventionType(contextText, interventions);
  const [selectedId, setSelectedId] = useState<string | null>(detected?.id ?? null);
  const activeId = selectedId ?? detected?.id ?? null;
  const { data: pack, isLoading: loadingPack } = useInterventionPack(activeId);

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState<Record<LineGroup, boolean>>({
    required: false,
    often: false,
    optional: true,
    labor: false,
    travel: false,
    waste: true,
  });

  const groupLines = (group: LineGroup): PackLine[] => {
    if (!pack) return [];
    switch (group) {
      case "required": return pack.required_products ?? [];
      case "often": return pack.often_added_products ?? [];
      case "optional": return pack.optional_products ?? [];
      case "labor": return pack.labor_lines ?? [];
      case "travel": return pack.travel_lines ?? [];
      case "waste": return pack.waste_lines ?? [];
    }
  };

  const keyFor = (group: LineGroup, idx: number) => `${group}-${idx}`;

  const toggleLine = (key: string) => setChecked((c) => ({ ...c, [key]: !c[key] }));

  const handleAddSelected = () => {
    const lines: PackLine[] = [];
    (Object.keys(GROUP_LABELS) as LineGroup[]).forEach((g) => {
      groupLines(g).forEach((l, i) => {
        if (checked[keyFor(g, i)]) lines.push(l);
      });
    });
    if (lines.length === 0) return;
    onAddLines(lines);
    setChecked({});
  };

  const handleAddAllRecommended = () => {
    const lines: PackLine[] = [
      ...groupLines("required"),
      ...groupLines("often"),
      ...groupLines("labor"),
      ...groupLines("travel"),
    ];
    if (lines.length === 0) return;
    onAddLines(lines);
  };

  const checkedCount = Object.values(checked).filter(Boolean).length;

  if (loadingTypes) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (!interventions.length) return null;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Suggestions intelligentes par intervention
          </CardTitle>
        </div>

        {/* Sélecteur d'intervention */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {interventions.slice(0, 8).map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => setSelectedId(it.id)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border transition-colors",
                activeId === it.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:border-primary/50"
              )}
            >
              {it.name}
              {detected?.id === it.id && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] py-0 px-1">
                  détecté
                </Badge>
              )}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {!activeId ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Sélectionne une intervention ci-dessus pour voir le matériel suggéré.
          </p>
        ) : loadingPack ? (
          <Skeleton className="h-32 w-full" />
        ) : !pack ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Aucun pack configuré pour cette intervention.
          </p>
        ) : (
          <>
            {(Object.keys(GROUP_LABELS) as LineGroup[]).map((group) => {
              const lines = groupLines(group);
              if (lines.length === 0) return null;
              const meta = GROUP_LABELS[group];
              const Icon = meta.icon;
              const isCollapsed = collapsed[group];
              return (
                <div key={group} className="rounded-md border bg-background/60">
                  <button
                    type="button"
                    onClick={() => setCollapsed((s) => ({ ...s, [group]: !s[group] }))}
                    className="w-full flex items-center justify-between p-2 text-xs font-medium hover:bg-muted/50"
                  >
                    <span className={cn("flex items-center gap-1.5", meta.color)}>
                      <Icon className="h-3.5 w-3.5" />
                      {meta.label}
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                        {lines.length}
                      </Badge>
                    </span>
                    {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                  </button>
                  {!isCollapsed && (
                    <ul className="divide-y">
                      {lines.map((l, i) => {
                        const k = keyFor(group, i);
                        return (
                          <li key={k} className="flex items-start gap-2 px-2 py-1.5">
                            <Checkbox
                              checked={!!checked[k]}
                              onCheckedChange={() => toggleLine(k)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium truncate">{l.label}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {l.qty} {l.unit}
                                {l.unit_price ? ` · ${l.unit_price}€ HT` : ""}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}

            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" onClick={handleAddSelected} disabled={checkedCount === 0}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Ajouter sélection ({checkedCount})
              </Button>
              <Button size="sm" variant="outline" onClick={handleAddAllRecommended}>
                Ajouter tout le pack
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)}>
                <X className="h-3.5 w-3.5 mr-1" />
                Masquer
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
