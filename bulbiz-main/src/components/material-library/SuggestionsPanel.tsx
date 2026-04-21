import { forwardRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Plus } from "lucide-react";
import { useUnknownSuggestions } from "@/hooks/useMaterialLibrary";

interface Props {
  search: string;
  onCreate: (initial: { label: string; unit?: string; unit_price?: number; vat_rate?: number }) => void;
}

export const SuggestionsPanel = forwardRef<HTMLDivElement, Props>(function SuggestionsPanel(
  { search, onCreate },
  ref,
) {
  const { data, isLoading } = useUnknownSuggestions(search);

  if (isLoading) return <p ref={ref as React.Ref<HTMLParagraphElement>} className="text-sm text-muted-foreground p-4">Analyse des devis passés…</p>;

  if (!data?.length) {
    return (
      <div ref={ref} className="text-center py-12 text-muted-foreground">
        <Sparkles className="h-10 w-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Aucune suggestion pour le moment.</p>
        <p className="text-xs mt-1">Bulbiz détecte les lignes que tu tapes souvent dans tes devis et te les propose ici.</p>
      </div>
    );
  }

  return (
    <div ref={ref} className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Lignes saisies plusieurs fois mais absentes de ton catalogue. Ajoute-les pour les retrouver instantanément.
      </p>
      {data.map((s) => (
        <Card key={s.label} className="p-3 flex items-center gap-3">
          <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{s.label}</p>
            <p className="text-xs text-muted-foreground">
              {s.count}× utilisé · {Number(s.unit_price ?? 0).toFixed(2)}€ / {s.unit ?? "u"} · TVA {s.vat_rate}%
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onCreate({
                label: s.label,
                unit: s.unit ?? "u",
                unit_price: Number(s.unit_price ?? 0),
                vat_rate: Number(s.vat_rate ?? 10),
              })
            }
          >
            <Plus className="h-3 w-3 mr-1" /> Ajouter
          </Button>
        </Card>
      ))}
    </div>
  );
});
