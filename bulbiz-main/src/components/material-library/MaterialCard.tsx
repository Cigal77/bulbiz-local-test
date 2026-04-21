import { forwardRef } from "react";
import { Star, Pencil, Trash2, Package, Wrench, Truck, Hammer, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LibraryMaterial } from "@/hooks/useMaterialLibrary";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface MaterialCardProps {
  material: LibraryMaterial;
  isOwner: boolean;
  onToggleFavorite?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const TYPE_META: Record<string, { icon: typeof Package; label: string; color: string }> = {
  MAIN_OEUVRE: { icon: Wrench, label: "Main d'œuvre", color: "bg-primary/10 text-primary" },
  main_oeuvre: { icon: Wrench, label: "Main d'œuvre", color: "bg-primary/10 text-primary" },
  DEPLACEMENT: { icon: Truck, label: "Déplacement", color: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  deplacement: { icon: Truck, label: "Déplacement", color: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  MATERIEL: { icon: Hammer, label: "Matériel", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  materiel: { icon: Hammer, label: "Matériel", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  PETITE_FOURNITURE: { icon: Box, label: "Fourniture", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  fourniture: { icon: Box, label: "Fourniture", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  standard: { icon: Package, label: "Standard", color: "bg-muted text-muted-foreground" },
};

export const MaterialCard = forwardRef<HTMLDivElement, MaterialCardProps>(function MaterialCard(
  { material, isOwner, onToggleFavorite, onEdit, onDelete },
  ref,
) {
  const meta = TYPE_META[material.type] ?? TYPE_META.standard;
  const Icon = meta.icon;

  return (
    <Card ref={ref} className="p-3 hover:shadow-md transition-shadow flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className={cn("rounded-md p-1.5 shrink-0", meta.color)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <h3 className="font-medium text-sm leading-tight truncate" title={material.label}>
              {material.label}
            </h3>
            {isOwner && (
              <button
                onClick={onToggleFavorite}
                className="shrink-0 text-muted-foreground hover:text-amber-500 transition-colors"
                aria-label={material.is_favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
              >
                <Star className={cn("h-4 w-4", material.is_favorite && "fill-amber-500 text-amber-500")} />
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground truncate">
            {material.category_path}
            {material.subcategory ? ` › ${material.subcategory}` : ""}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-baseline gap-1">
          <span className="font-semibold text-foreground">{Number(material.unit_price ?? 0).toFixed(2)} €</span>
          <span className="text-muted-foreground">/ {material.unit ?? "u"}</span>
        </div>
        <Badge variant="outline" className="text-[10px] h-5 px-1.5">TVA {material.vat_rate}%</Badge>
      </div>

      {(material.supplier || material.brand) && (
        <p className="text-[10px] text-muted-foreground truncate">
          {[material.brand, material.supplier].filter(Boolean).join(" · ")}
        </p>
      )}

      {(material.usage_count > 0 || material.last_used_at) && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {material.usage_count > 0 && <span>🔥 {material.usage_count}×</span>}
          {material.last_used_at && (
            <span>· {formatDistanceToNow(new Date(material.last_used_at), { addSuffix: true, locale: fr })}</span>
          )}
        </div>
      )}

      {isOwner && (
        <div className="flex gap-1 pt-1 border-t">
          <Button variant="ghost" size="sm" className="h-7 px-2 flex-1 text-xs" onClick={onEdit}>
            <Pencil className="h-3 w-3 mr-1" /> Éditer
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </Card>
  );
});
