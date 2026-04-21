import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface MaterialSuggestion {
  id?: string;
  label: string;
  unit: string;
  unit_price: number;
  vat_rate: number;
  type: string;
  source: "favorite" | "recent" | "frequent" | "bulbiz" | "history";
  category_path?: string;
  last_used_price?: number | null;
  usage_count?: number;
}

/**
 * Suggestions intelligentes pour l'autocomplete de l'éditeur de devis.
 * Combine catalog_material (favoris/récents/fréquents/Bulbiz) + catalog_usage_log (lignes manuelles répétées).
 */
export function useMaterialSuggestions(query: string) {
  const { user } = useAuth();
  const trimmed = query.trim();

  return useQuery({
    queryKey: ["material-suggestions-quote", trimmed, user?.id],
    queryFn: async (): Promise<MaterialSuggestion[]> => {
      if (!user || trimmed.length < 2) return [];
      const s = trimmed;
      const ilike = `%${s}%`;

      // 1. Catalog (own + Bulbiz)
      const { data: cat } = await supabase
        .from("catalog_material")
        .select("id, label, unit, unit_price, vat_rate, type, category_path, is_favorite, usage_count, last_used_at, last_used_price, user_id")
        .or(`label.ilike.${ilike},tags.cs.{"${s.toLowerCase()}"},internal_code.ilike.${ilike}`)
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .limit(40);

      const fromCatalog: MaterialSuggestion[] = (cat ?? []).map((m: any) => {
        let source: MaterialSuggestion["source"] = "bulbiz";
        if (m.user_id === user.id) {
          if (m.is_favorite) source = "favorite";
          else if (m.usage_count > 0) source = "frequent";
          else source = "recent";
        }
        return {
          id: m.id,
          label: m.label,
          unit: m.unit ?? "u",
          unit_price: Number(m.last_used_price ?? m.unit_price ?? 0),
          vat_rate: Number(m.vat_rate ?? 10),
          type: m.type,
          source,
          category_path: m.category_path,
          last_used_price: m.last_used_price,
          usage_count: m.usage_count ?? 0,
        };
      });

      // 2. History (lignes saisies à la main souvent)
      const { data: hist } = await supabase
        .from("catalog_usage_log")
        .select("label, unit, unit_price, vat_rate, created_at")
        .eq("user_id", user.id)
        .is("material_id", null)
        .ilike("label", ilike)
        .order("created_at", { ascending: false })
        .limit(60);

      // Agrégation par label
      const histMap = new Map<string, { item: MaterialSuggestion; count: number }>();
      for (const row of hist ?? []) {
        const key = (row.label || "").trim().toLowerCase();
        if (!key) continue;
        const existing = histMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          histMap.set(key, {
            count: 1,
            item: {
              label: row.label,
              unit: row.unit ?? "u",
              unit_price: Number(row.unit_price ?? 0),
              vat_rate: Number(row.vat_rate ?? 10),
              type: "standard",
              source: "history",
              usage_count: 1,
            },
          });
        }
      }

      // Filtrer historique : ne pas dupliquer ce qui est déjà en catalogue
      const catLabels = new Set(fromCatalog.map((c) => c.label.toLowerCase()));
      const fromHistory = Array.from(histMap.values())
        .filter((h) => !catLabels.has(h.item.label.toLowerCase()) && h.count >= 2)
        .map((h) => ({ ...h.item, usage_count: h.count }));

      // Tri global : favori > frequent > recent > history > bulbiz
      const order: Record<MaterialSuggestion["source"], number> = {
        favorite: 0,
        frequent: 1,
        recent: 2,
        history: 3,
        bulbiz: 4,
      };
      const all = [...fromCatalog, ...fromHistory].sort((a, b) => {
        if (order[a.source] !== order[b.source]) return order[a.source] - order[b.source];
        return (b.usage_count ?? 0) - (a.usage_count ?? 0);
      });

      return all.slice(0, 30);
    },
    enabled: !!user && trimmed.length >= 2,
    staleTime: 1000 * 20,
  });
}
