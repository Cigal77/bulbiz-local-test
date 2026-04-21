import { Sparkles, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  useInterventionTypes,
  useInterventionPack,
  detectInterventionType,
  type PackLine,
} from "@/hooks/useInterventionTypes";

interface Props {
  contextText: string;
  onLoadPack: (lines: PackLine[]) => void;
}

export function InterventionDetectedBadge({ contextText, onLoadPack }: Props) {
  const { data: interventions = [] } = useInterventionTypes();
  const detected = detectInterventionType(contextText, interventions);
  const { data: pack } = useInterventionPack(detected?.id ?? null);
  const [dismissed, setDismissed] = useState(false);

  if (!detected || dismissed) return null;

  const handleLoad = () => {
    if (!pack) return;
    const lines: PackLine[] = [
      ...(pack.required_products ?? []),
      ...(pack.often_added_products ?? []),
      ...(pack.labor_lines ?? []),
      ...(pack.travel_lines ?? []),
    ];
    if (lines.length === 0) return;
    onLoadPack(lines);
    setDismissed(true);
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-gradient-to-r from-primary/5 to-transparent p-3 flex flex-wrap items-center gap-2">
      <Sparkles className="h-4 w-4 text-primary shrink-0" />
      <span className="text-xs font-medium">Intervention détectée :</span>
      <Badge variant="secondary" className="text-xs">
        {detected.name}
      </Badge>
      {pack && (
        <Button size="sm" variant="default" onClick={handleLoad} className="ml-auto h-7 text-xs gap-1">
          <Plus className="h-3.5 w-3.5" />
          Charger le pack
        </Button>
      )}
      <Button
        size="icon"
        variant="ghost"
        onClick={() => setDismissed(true)}
        className="h-7 w-7"
        aria-label="Masquer"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
