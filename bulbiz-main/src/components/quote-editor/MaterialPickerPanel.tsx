import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, ArrowLeft, Package } from "lucide-react";
import { useMaterialCatalog, useMaterialCorrespondence, type CatalogMaterial } from "@/hooks/useMaterialCatalog";
import { RecommendationTabs } from "./RecommendationTabs";
import type { QuoteItem } from "@/lib/quote-types";
import { useToast } from "@/hooks/use-toast";

interface MaterialPickerPanelProps {
  onAddItem: (item: Omit<QuoteItem, "id">) => void;
}

function catalogTypeToQuoteType(catalogType: string): QuoteItem["type"] {
  if (catalogType === "GROSSE_FOURNITURE") return "materiel";
  if (catalogType === "PETITE_FOURNITURE") return "fourniture";
  if (catalogType === "CONSOMMABLE") return "fourniture";
  return "standard";
}

export function MaterialPickerPanel({ onAddItem }: MaterialPickerPanelProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const { data: materials = [], isLoading } = useMaterialCatalog(search);
  const { data: correspondences = [] } = useMaterialCorrespondence(selectedMaterialId);

  const selectedMaterial = materials.find((m) => m.id === selectedMaterialId);

  const addMaterial = (mat: CatalogMaterial) => {
    onAddItem({
      label: mat.label,
      description: "",
      qty: Number(mat.default_qty),
      unit: mat.unit,
      unit_price: Number(mat.unit_price),
      vat_rate: Number(mat.vat_rate),
      discount: 0,
      type: catalogTypeToQuoteType(mat.type),
    });
    toast({ title: "✅ Ajouté", description: mat.label });
  };

  const handleAddCorrespondence = (item: { label: string; description?: string; unit: string; default_qty: number; unit_price: number; vat_rate: number }) => {
    onAddItem({
      label: item.label,
      description: item.description || "",
      qty: Number(item.default_qty),
      unit: item.unit,
      unit_price: Number(item.unit_price),
      vat_rate: Number(item.vat_rate),
      discount: 0,
      type: "fourniture",
    });
    toast({ title: "✅ Ajouté", description: item.label });
  };

  // Detail view
  if (selectedMaterial) {
    const corrItems = correspondences
      .filter((c) => c.target)
      .map((c) => ({
        id: c.id,
        label: c.target!.label,
        description: "",
        unit: c.target!.unit,
        default_qty: Number(c.default_qty || c.target!.default_qty),
        unit_price: Number(c.target!.unit_price),
        vat_rate: Number(c.target!.vat_rate),
        weight: c.weight,
        group_label: c.group_label,
      }));

    return (
      <div className="flex flex-col h-full">
        <Button variant="ghost" size="sm" className="justify-start gap-1.5 mb-2 -ml-2" onClick={() => setSelectedMaterialId(null)}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour
        </Button>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-foreground">{selectedMaterial.label}</h3>
          <p className="text-xs text-muted-foreground">{selectedMaterial.category_path}</p>
        </div>

        {/* Add the main material */}
        <Button size="sm" variant="outline" className="gap-1.5 mb-3" onClick={() => addMaterial(selectedMaterial)}>
          <Plus className="h-3.5 w-3.5" />
          Ajouter {selectedMaterial.label}
        </Button>

        <ScrollArea className="flex-1">
          {corrItems.length > 0 ? (
            <>
              <p className="text-xs font-semibold text-primary mb-2">Fournitures indispensables</p>
              <RecommendationTabs items={corrItems} onAdd={handleAddCorrespondence} />
            </>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">
              Aucune fourniture associée.
            </p>
          )}
        </ScrollArea>
      </div>
    );
  }

  // Catalog
  const grosses = materials.filter((m) => m.type === "GROSSE_FOURNITURE");
  const petites = materials.filter((m) => m.type === "PETITE_FOURNITURE");
  const consommables = materials.filter((m) => m.type === "CONSOMMABLE");

  const renderSection = (title: string, items: CatalogMaterial[], showCorr: boolean) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-4">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{title}</p>
        {items.map((mat) => (
          <div key={mat.id} className="flex items-center justify-between gap-2 py-2 px-2.5 rounded-lg hover:bg-muted/50 group">
            <button
              className="min-w-0 flex-1 text-left"
              onClick={() => showCorr ? setSelectedMaterialId(mat.id) : addMaterial(mat)}
            >
              <p className="text-sm font-medium truncate">{mat.label}</p>
              <div className="flex gap-1.5 mt-0.5">
                <Badge variant="outline" className="text-[10px] px-1 py-0">{mat.default_qty} {mat.unit}</Badge>
                <Badge variant="outline" className="text-[10px] px-1 py-0">{mat.unit_price} €</Badge>
              </div>
            </button>
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 opacity-60 group-hover:opacity-100" onClick={() => addMaterial(mat)}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Rechercher un matériel…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>
      <ScrollArea className="flex-1">
        {isLoading ? (
          <p className="text-xs text-muted-foreground text-center py-4">Chargement…</p>
        ) : materials.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
            <p className="text-xs text-muted-foreground">Aucun matériel trouvé</p>
          </div>
        ) : (
          <>
            {renderSection("Grosse fourniture", grosses, true)}
            {renderSection("Petite fourniture", petites, false)}
            {renderSection("Consommables", consommables, false)}
          </>
        )}
      </ScrollArea>
    </div>
  );
}
