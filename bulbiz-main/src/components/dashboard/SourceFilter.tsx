import { SOURCE_LABELS } from "@/lib/constants";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type DossierSource = Database["public"]["Enums"]["dossier_source"];

interface SourceFilterProps {
  active: DossierSource | null;
  onChange: (source: DossierSource | null) => void;
}

export function SourceFilter({ active, onChange }: SourceFilterProps) {
  const sources: DossierSource[] = ["lien_client", "manuel", "email"];

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant={active === null ? "secondary" : "ghost"}
        size="sm"
        onClick={() => onChange(null)}
        className="text-xs"
      >
        Toutes
      </Button>
      {sources.map((source) => (
        <Button
          key={source}
          variant={active === source ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onChange(active === source ? null : source)}
          className="text-xs"
        >
          {SOURCE_LABELS[source]}
        </Button>
      ))}
    </div>
  );
}
