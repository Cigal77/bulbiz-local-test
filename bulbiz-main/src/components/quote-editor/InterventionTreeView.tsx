import { useState } from "react";
import { ChevronRight, ChevronDown, Sparkles, Wrench, Package, Truck, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useInterventionTypes,
  useInterventionPack,
  detectInterventionType,
  type PackLine,
} from "@/hooks/useInterventionTypes";

interface Props {
  contextText: string;
  onAddLines: (lines: PackLine[]) => void;
}

const STEPS: Array<{ key: keyof StepLines; label: string; icon: any; color: string }> = [
  { key: "required_products", label: "1. Matériel principal", icon: Sparkles, color: "text-primary" },
  { key: "often_added_products", label: "2. Souvent associé", icon: Plus, color: "text-blue-600" },
  { key: "labor_lines", label: "3. Main d'œuvre", icon: Wrench, color: "text-orange-600" },
  { key: "travel_lines", label: "4. Déplacement", icon: Truck, color: "text-purple-600" },
  { key: "optional_products", label: "5. Options", icon: Package, color: "text-muted-foreground" },
  { key: "waste_lines", label: "6. Déchets", icon: Trash2, color: "text-green-600" },
];

type StepLines = {
  required_products: PackLine[];
  often_added_products: PackLine[];
  optional_products: PackLine[];
  labor_lines: PackLine[];
  travel_lines: PackLine[];
  waste_lines: PackLine[];
};

export function InterventionTreeView({ contextText, onAddLines }: Props) {
  const { data: interventions = [], isLoading } = useInterventionTypes();
  const detected = detectInterventionType(contextText, interventions);
  const [selectedId, setSelectedId] = useState<string | null>(detected?.id ?? null);
  const activeId = selectedId ?? detected?.id ?? null;
  const { data: pack, isLoading: loadingPack } = useInterventionPack(activeId);
  const [openSteps, setOpenSteps] = useState<Set<string>>(new Set(["required_products"]));

  const toggle = (key: string) =>
    setOpenSteps((s) => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  if (isLoading) return <Skeleton className="h-full w-full" />;

  return (
    <div className="space-y-3 overflow-y-auto h-full pr-1">
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Choisir une intervention</p>
        <div className="flex flex-wrap gap-1.5">
          {interventions.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => setSelectedId(it.id)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border transition-colors",
                activeId === it.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:border-primary/50",
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
      </div>

      {!activeId ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          Sélectionne une intervention pour voir ses étapes.
        </p>
      ) : loadingPack ? (
        <Skeleton className="h-32 w-full" />
      ) : !pack ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          Aucun arbre configuré pour cette intervention.
        </p>
      ) : (
        <div className="space-y-1.5">
          {STEPS.map((step) => {
            const lines = ((pack as any)[step.key] ?? []) as PackLine[];
            if (lines.length === 0) return null;
            const isOpen = openSteps.has(step.key);
            const Icon = step.icon;
            return (
              <div key={step.key} className="rounded-md border bg-background">
                <button
                  type="button"
                  onClick={() => toggle(step.key)}
                  className="w-full flex items-center gap-2 p-2 text-xs font-medium hover:bg-muted/40"
                >
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  <Icon className={cn("h-3.5 w-3.5", step.color)} />
                  <span className="flex-1 text-left">{step.label}</span>
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                    {lines.length}
                  </Badge>
                </button>
                {isOpen && (
                  <div className="border-t divide-y">
                    {lines.map((l, i) => (
                      <div key={i} className="px-3 py-1.5 text-xs flex items-start gap-2">
                        <span className="text-muted-foreground mt-0.5">•</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{l.label}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {l.qty} {l.unit}
                            {l.unit_price ? ` · ${l.unit_price}€ HT` : ""}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="p-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-7 text-xs"
                        onClick={() => onAddLines(lines)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Ajouter cette étape
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
