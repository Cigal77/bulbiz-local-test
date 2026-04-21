import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CatalogMaterial {
  id: string;
  category_path: string;
  label: string;
  type: string;
  unit: string;
  default_qty: number;
  unit_price: number;
  vat_rate: number;
  tags: string[];
}

export function useMaterialCatalog(search: string, category?: string) {
  return useQuery({
    queryKey: ["catalog-material", search, category],
    queryFn: async () => {
      let query = supabase.from("catalog_material").select("*").order("category_path");
      if (search) {
        // Search across label, tags array, and synonyms array using OR
        query = query.or(`label.ilike.%${search}%,tags.cs.{"${search.toLowerCase()}"},category_path.ilike.%${search}%`);
      }
      if (category) {
        query = query.ilike("category_path", `${category}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as CatalogMaterial[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export interface MaterialCorrespondence {
  id: string;
  source_material_id: string;
  target_material_id: string;
  weight: number;
  default_qty: number;
  group_label: string;
  target?: CatalogMaterial;
}

export function useMaterialCorrespondence(materialId: string | null) {
  return useQuery({
    queryKey: ["material-correspondence", materialId],
    queryFn: async () => {
      if (!materialId) return [];
      const { data: corr, error } = await supabase
        .from("material_correspondence")
        .select("*")
        .eq("source_material_id", materialId)
        .order("weight", { ascending: false });
      if (error) throw error;
      if (!corr || corr.length === 0) return [];

      // Fetch target materials
      const targetIds = corr.map((c: any) => c.target_material_id);
      const { data: materials } = await supabase
        .from("catalog_material")
        .select("*")
        .in("id", targetIds);

      const matMap = new Map((materials ?? []).map((m: any) => [m.id, m]));
      return corr.map((c: any) => ({
        ...c,
        target: matMap.get(c.target_material_id) as CatalogMaterial | undefined,
      })) as MaterialCorrespondence[];
    },
    enabled: !!materialId,
  });
}
