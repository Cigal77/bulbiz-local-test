import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PackageOpen, Plus, ArrowLeft, CheckCircle2, Info } from "lucide-react";
import { useSuggestedBundles, useBundleItems, type BundleTemplate } from "@/hooks/useBundles";
import type { QuoteItem, QuoteItemType } from "@/lib/quote-types";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface BundleSuggestionPanelProps {
  dossierCategory?: string;
  dossierDescription?: string;
  onAddItems: (items: Omit<QuoteItem, "id">[]) => void;
  onAddItem: (item: Omit<QuoteItem, "id">) => void;
}

function itemTypeToQuoteType(t: string): QuoteItemType {
  if (t === "main_oeuvre" || t === "deplacement" || t === "materiel" || t === "fourniture") return t;
  return "standard";
}

export function BundleSuggestionPanel({ dossierCategory, dossierDescription, onAddItems, onAddItem }: BundleSuggestionPanelProps) {
  const { toast } = useToast();
  const { data: suggested, allBundles, isLoading } = useSuggestedBundles(dossierCategory, dossierDescription);
  const [selectedBundle, setSelectedBundle] = useState<BundleTemplate | null>(null);
  const { data: bundleItems = [] } = useBundleItems(selectedBundle?.id ?? null);

  const handleAddPack = () => {
    if (bundleItems.length === 0) return;
    const requiredItems = bundleItems.filter((i) => !i.is_optional);
    const items: Omit<QuoteItem, "id">[] = requiredItems.map((i) => ({
      label: i.label,
      description: i.description || "",
      qty: Number(i.default_qty),
      unit: i.unit,
      unit_price: Number(i.unit_price),
      vat_rate: Number(i.vat_rate),
      discount: 0,
      type: itemTypeToQuoteType(i.item_type),
    }));
    onAddItems(items);
    toast({
      title: `✅ Pack ajouté`,
      description: `${items.length} lignes ajoutées — ${selectedBundle?.bundle_name}`,
    });
  };

  const handleAddSingleItem = (i: typeof bundleItems[0]) => {
    onAddItem({
      label: i.label,
      description: i.description || "",
      qty: Number(i.default_qty),
      unit: i.unit,
      unit_price: Number(i.unit_price),
      vat_rate: Number(i.vat_rate),
      discount: 0,
      type: itemTypeToQuoteType(i.item_type),
    });
    toast({ title: "✅ Ajouté", description: i.label });
  };

  // Detail view for selected bundle
  if (selectedBundle) {
    const requiredCount = bundleItems.filter((i) => !i.is_optional).length;
    const optionalItems = bundleItems.filter((i) => i.is_optional);
    const requiredItems = bundleItems.filter((i) => !i.is_optional);

    return (
      <div className="flex flex-col h-full">
        <Button variant="ghost" size="sm" className="justify-start gap-1.5 mb-2 -ml-2" onClick={() => setSelectedBundle(null)}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour
        </Button>

        <div className="mb-3">
          <h3 className="text-sm font-semibold text-foreground">{selectedBundle.bundle_name}</h3>
          {selectedBundle.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{selectedBundle.description}</p>
          )}
        </div>

        <ScrollArea className="flex-1">
          {requiredItems.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Inclus dans le pack</p>
              {requiredItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 group">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    <div className="flex gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[10px] px-1 py-0">{Number(item.default_qty)} {item.unit}</Badge>
                      <Badge variant="outline" className="text-[10px] px-1 py-0">{Number(item.unit_price)}€</Badge>
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">{item.item_type === "main_oeuvre" ? "MO" : item.item_type === "deplacement" ? "Dépl." : item.item_type === "materiel" ? "Mat." : item.item_type === "fourniture" ? "Fourn." : "Divers"}</Badge>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 opacity-60 group-hover:opacity-100" onClick={() => handleAddSingleItem(item)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {optionalItems.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Optionnel</p>
              {optionalItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 group opacity-70">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    <div className="flex gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[10px] px-1 py-0">{Number(item.default_qty)} {item.unit}</Badge>
                      <Badge variant="outline" className="text-[10px] px-1 py-0">{Number(item.unit_price)}€</Badge>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 opacity-60 group-hover:opacity-100" onClick={() => handleAddSingleItem(item)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {requiredCount > 0 && (
          <div className="pt-3 mt-2 border-t">
            <Button className="w-full gap-2" size="sm" onClick={handleAddPack}>
              <CheckCircle2 className="h-4 w-4" />
              Ajouter le pack ({requiredCount} lignes)
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Bundle list
  const isSuggested = suggested.length < allBundles.length;

  return (
    <div className="flex flex-col h-full">
      {isSuggested && (
        <div className="flex items-center gap-1.5 mb-3 px-1">
          <Info className="h-3.5 w-3.5 text-primary shrink-0" />
          <p className="text-xs text-muted-foreground">
            Packs suggérés pour ce dossier
          </p>
        </div>
      )}

      <ScrollArea className="flex-1">
        {isLoading ? (
          <p className="text-xs text-muted-foreground text-center py-4">Chargement…</p>
        ) : suggested.length === 0 ? (
          <div className="text-center py-8">
            <PackageOpen className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
            <p className="text-xs text-muted-foreground">Aucun pack disponible</p>
          </div>
        ) : (
          <div className="space-y-1">
            {suggested.map((bundle) => (
              <TooltipProvider key={bundle.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted/50 group transition-colors"
                      onClick={() => setSelectedBundle(bundle)}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate">{bundle.bundle_name}</p>
                        <PackageOpen className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
                      </div>
                      {bundle.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{bundle.description}</p>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="text-xs">{bundle.description || bundle.bundle_name}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}

            {isSuggested && allBundles.length > suggested.length && (
              <>
                <div className="px-3 pt-3 pb-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Autres packs</p>
                </div>
                {allBundles
                  .filter((b) => !suggested.some((s) => s.id === b.id))
                  .map((bundle) => (
                    <button
                      key={bundle.id}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/50 group transition-colors opacity-70"
                      onClick={() => setSelectedBundle(bundle)}
                    >
                      <p className="text-sm font-medium truncate">{bundle.bundle_name}</p>
                    </button>
                  ))}
              </>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
