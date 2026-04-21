import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductSector {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  sort_order: number;
  active: boolean;
}

export interface ProductCategory {
  id: string;
  sector_id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  level: number;
  sort_order: number;
}

export function useProductSectors() {
  return useQuery({
    queryKey: ["product-sectors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_sectors")
        .select("*")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as ProductSector[];
    },
    staleTime: 1000 * 60 * 30,
  });
}

export function useProductCategories(sectorId?: string | null) {
  return useQuery({
    queryKey: ["product-categories", sectorId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("product_categories").select("*").order("sort_order");
      if (sectorId) q = q.eq("sector_id", sectorId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ProductCategory[];
    },
    staleTime: 1000 * 60 * 30,
  });
}
