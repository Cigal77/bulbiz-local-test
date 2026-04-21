import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, ArrowDownUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProductSectors, useProductCategories } from "@/hooks/useProductTaxonomy";
import type { LibraryMaterial } from "@/hooks/useMaterialLibrary";

export type MaterialSort = "popular" | "alpha" | "price_asc" | "price_desc";

export interface MaterialFiltersValue {
  sectorId: string | null;
  categoryId: string | null;
  type: string | null;
  brand: string | null;
  sort: MaterialSort;
}

export const DEFAULT_FILTERS: MaterialFiltersValue = {
  sectorId: null,
  categoryId: null,
  type: null,
  brand: null,
  sort: "alpha",
};

const TYPE_OPTIONS = [
  { value: "MATERIEL", label: "🔧 Matériel" },
  { value: "PETITE_FOURNITURE", label: "📦 Fourniture" },
  { value: "MAIN_OEUVRE", label: "👷 Main d'œuvre" },
  { value: "DEPLACEMENT", label: "🚚 Déplacement" },
  { value: "standard", label: "✨ Forfait" },
];

const SORT_OPTIONS: { value: MaterialSort; label: string }[] = [
  { value: "popular", label: "🔥 Plus utilisés" },
  { value: "alpha", label: "🔤 A → Z" },
  { value: "price_asc", label: "💶 Prix croissant" },
  { value: "price_desc", label: "💶 Prix décroissant" },
];

interface Props {
  value: MaterialFiltersValue;
  onChange: (next: MaterialFiltersValue) => void;
  results: LibraryMaterial[];
  resultCount: number;
}

export function MaterialFilters({ value, onChange, results, resultCount }: Props) {
  const { data: sectors = [] } = useProductSectors();
  const { data: categories = [] } = useProductCategories(value.sectorId ?? undefined);

  // Liste des marques distinctes extraites des résultats actuels
  const brands = useMemo(() => {
    const set = new Set<string>();
    for (const m of results) if (m.brand?.trim()) set.add(m.brand.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [results]);

  const hasActive =
    !!value.sectorId || !!value.categoryId || !!value.type || !!value.brand || value.sort !== "alpha";

  const reset = () => onChange(DEFAULT_FILTERS);
  const patch = (p: Partial<MaterialFiltersValue>) => onChange({ ...value, ...p });

  return (
    <div className="space-y-3">
      {/* Chips secteurs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
        <SectorChip
          active={!value.sectorId}
          label="Tous les secteurs"
          icon="🏗️"
          onClick={() => patch({ sectorId: null, categoryId: null })}
        />
        {sectors.map((s) => (
          <SectorChip
            key={s.id}
            active={value.sectorId === s.id}
            label={s.name}
            icon={s.icon ?? "📦"}
            onClick={() =>
              patch({
                sectorId: value.sectorId === s.id ? null : s.id,
                categoryId: null,
              })
            }
          />
        ))}
      </div>

      {/* Filtres dropdowns */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select
          value={value.categoryId ?? "all"}
          onValueChange={(v) => patch({ categoryId: v === "all" ? null : v })}
          disabled={!value.sectorId || categories.length === 0}
        >
          <SelectTrigger className="h-9 w-[180px] text-xs">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={value.type ?? "all"}
          onValueChange={(v) => patch({ type: v === "all" ? null : v })}
        >
          <SelectTrigger className="h-9 w-[150px] text-xs">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            {TYPE_OPTIONS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={value.brand ?? "all"}
          onValueChange={(v) => patch({ brand: v === "all" ? null : v })}
          disabled={brands.length === 0}
        >
          <SelectTrigger className="h-9 w-[150px] text-xs">
            <SelectValue placeholder={brands.length === 0 ? "Aucune marque" : "Marque"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes marques</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={value.sort}
          onValueChange={(v) => patch({ sort: v as MaterialSort })}
        >
          <SelectTrigger className="h-9 w-[170px] text-xs">
            <ArrowDownUp className="h-3.5 w-3.5 mr-1.5 opacity-60" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActive && (
          <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={reset}>
            <X className="h-3.5 w-3.5 mr-1" /> Réinitialiser
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {value.sectorId && (
            <Badge className="text-xs bg-primary/15 text-primary border-primary/20">
              {sectors.find((s) => s.id === value.sectorId)?.name ?? "Secteur"}
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs">
            {resultCount} article{resultCount > 1 ? "s" : ""}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function SectorChip({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background hover:bg-accent border-border text-foreground",
      )}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
