import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type MaterialTab =
  | "mine"
  | "recent"
  | "favorites"
  | "frequent"
  | "bulbiz"
  | "imported"
  | "suggestions";

export interface LibraryMaterial {
  id: string;
  user_id: string | null;
  label: string;
  category_path: string;
  subcategory: string | null;
  description?: string | null;
  type: string;
  unit: string | null;
  unit_price: number | null;
  vat_rate: number | null;
  default_qty: number | null;
  tags: string[] | null;
  supplier: string | null;
  supplier_ref: string | null;
  internal_code: string | null;
  brand: string | null;
  notes: string | null;
  is_favorite: boolean;
  usage_count: number;
  last_used_at: string | null;
  last_used_price: number | null;
  import_batch_id: string | null;
  created_at: string;
}

export interface UnknownSuggestion {
  label: string;
  unit: string | null;
  unit_price: number | null;
  vat_rate: number | null;
  count: number;
  last_used_at: string;
}

export interface MaterialFilters {
  sectorId?: string | null;
  categoryId?: string | null;
  type?: string | null;
  brand?: string | null;
  sort?: "popular" | "alpha" | "price_asc" | "price_desc";
}

export function useMaterialLibrary(
  tab: MaterialTab,
  search: string,
  filters: MaterialFilters = {},
) {
  const { user } = useAuth();
  const { sectorId, categoryId, type, brand, sort = "alpha" } = filters;

  return useQuery({
    queryKey: [
      "material-library",
      tab,
      search,
      sectorId ?? null,
      categoryId ?? null,
      type ?? null,
      brand ?? null,
      sort,
      user?.id,
    ],
    queryFn: async (): Promise<LibraryMaterial[]> => {
      if (!user) return [];

      let query = supabase.from("catalog_material").select("*");

      switch (tab) {
        case "mine":
          query = query.eq("user_id", user.id);
          break;
        case "favorites":
          query = query.eq("user_id", user.id).eq("is_favorite", true);
          break;
        case "frequent":
          query = query.eq("user_id", user.id).gt("usage_count", 0);
          break;
        case "recent":
          query = query.eq("user_id", user.id).not("last_used_at", "is", null);
          break;
        case "bulbiz":
          query = query.is("user_id", null);
          break;
        case "imported":
          query = query.eq("user_id", user.id).not("import_batch_id", "is", null);
          break;
        case "suggestions":
          return [];
      }

      // Filtres additionnels
      // Filtre secteur : article appartient au secteur principal OU dans secondaires
      if (sectorId) {
        query = query.or(
          `sector_id.eq.${sectorId},secondary_sector_ids.cs.{${sectorId}}`,
        );
      }
      if (categoryId) query = query.eq("category_id", categoryId);
      if (type) query = query.eq("type", type);
      if (brand) query = query.ilike("brand", brand);

      if (search.trim().length >= 2) {
        const s = search.trim();
        query = query.or(
          `label.ilike.%${s}%,normalized_name.ilike.%${s.toLowerCase()}%,supplier.ilike.%${s}%,internal_code.ilike.%${s}%,brand.ilike.%${s}%`,
        );
      }

      // Tri
      if (tab === "recent") {
        query = query.order("last_used_at", { ascending: false });
      } else {
        switch (sort) {
          case "popular":
            query = query.order("usage_count", { ascending: false }).order("label");
            break;
          case "price_asc":
            query = query.order("unit_price", { ascending: true, nullsFirst: false });
            break;
          case "price_desc":
            query = query.order("unit_price", { ascending: false, nullsFirst: false });
            break;
          case "alpha":
          default:
            query = query.order("label", { ascending: true });
        }
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;
      return (data ?? []) as LibraryMaterial[];
    },
    enabled: !!user && tab !== "suggestions",
    staleTime: 1000 * 30,
  });
}

export function useUnknownSuggestions(search: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["material-suggestions", search, user?.id],
    queryFn: async (): Promise<UnknownSuggestion[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("catalog_usage_log")
        .select("label, unit, unit_price, vat_rate, created_at")
        .eq("user_id", user.id)
        .is("material_id", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const map = new Map<string, UnknownSuggestion>();
      for (const row of data ?? []) {
        const key = (row.label || "").trim().toLowerCase();
        if (!key) continue;
        const existing = map.get(key);
        if (existing) {
          existing.count++;
        } else {
          map.set(key, {
            label: row.label,
            unit: row.unit,
            unit_price: row.unit_price,
            vat_rate: row.vat_rate,
            count: 1,
            last_used_at: row.created_at,
          });
        }
      }
      let list = Array.from(map.values()).sort((a, b) => b.count - a.count);
      if (search.trim().length >= 2) {
        const s = search.toLowerCase();
        list = list.filter((x) => x.label.toLowerCase().includes(s));
      }
      return list.slice(0, 100);
    },
    enabled: !!user,
    staleTime: 1000 * 30,
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_favorite }: { id: string; is_favorite: boolean }) => {
      const { error } = await supabase.from("catalog_material").update({ is_favorite }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["material-library"] }),
  });
}

export function useDeleteMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("catalog_material").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material-library"] });
      toast.success("Article supprimé");
    },
    onError: (e: any) => toast.error("Suppression impossible : " + e.message),
  });
}

export interface MaterialUpsertPayload {
  id?: string;
  label: string;
  category_path: string;
  subcategory?: string | null;
  type: string;
  unit: string;
  unit_price: number;
  vat_rate: number;
  default_qty?: number;
  tags?: string[];
  supplier?: string | null;
  supplier_ref?: string | null;
  internal_code?: string | null;
  brand?: string | null;
  notes?: string | null;
  is_favorite?: boolean;
}

export function useUpsertMaterial() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (payload: MaterialUpsertPayload) => {
      if (!user) throw new Error("Non authentifié");
      const { id, ...data } = payload;
      if (id) {
        const { error } = await supabase.from("catalog_material").update(data).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("catalog_material").insert({ ...data, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material-library"] });
      qc.invalidateQueries({ queryKey: ["material-suggestions-quote"] });
      toast.success("Article enregistré");
    },
    onError: (e: any) => toast.error("Erreur : " + e.message),
  });
}

export function useImportJobs() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["catalog-import-jobs", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("catalog_import_jobs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}
