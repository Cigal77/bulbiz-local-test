import { useMemo } from "react";
import { MaterialCard } from "@/components/material-library/MaterialCard";
import type { LibraryMaterial } from "@/hooks/useMaterialLibrary";

interface Props {
  materials: LibraryMaterial[];
  currentUserId?: string | null;
  onToggleFavorite: (m: LibraryMaterial) => void;
  onEdit: (m: LibraryMaterial) => void;
  onDelete: (m: LibraryMaterial) => void;
}

export function MaterialGroupedGrid({
  materials,
  currentUserId,
  onToggleFavorite,
  onEdit,
  onDelete,
}: Props) {
  const groups = useMemo(() => {
    const map = new Map<string, LibraryMaterial[]>();
    for (const m of materials) {
      const key = m.category_path?.trim() || "Autres";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "fr"));
  }, [materials]);

  return (
    <div className="space-y-6">
      {groups.map(([category, items]) => (
        <section key={category}>
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 -mx-1 px-1 py-2 mb-2 border-b">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span className="text-foreground">{category}</span>
              <span className="text-xs font-normal text-muted-foreground">
                ({items.length})
              </span>
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {items.map((m) => (
              <MaterialCard
                key={m.id}
                material={m}
                isOwner={m.user_id === currentUserId}
                onToggleFavorite={() => onToggleFavorite(m)}
                onEdit={() => onEdit(m)}
                onDelete={() => onDelete(m)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
