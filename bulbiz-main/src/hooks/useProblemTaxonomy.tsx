import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TaxonomyNode {
  id: string;
  parent_id: string | null;
  label: string;
  keywords: string[];
  default_context: Record<string, unknown>;
  sort_order: number;
}

export function useProblemTaxonomy() {
  return useQuery({
    queryKey: ["problem-taxonomy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("problem_taxonomy")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as TaxonomyNode[];
    },
    staleTime: 1000 * 60 * 10,
  });
}

export interface Manoeuvre {
  id: string;
  problem_id: string;
  label: string;
  description: string;
  unit: string;
  default_qty: number;
  unit_price: number;
  vat_rate: number;
  weight: number;
  type: string;
}

export function useProblemManoeuvres(problemId: string | null) {
  return useQuery({
    queryKey: ["problem-manoeuvres", problemId],
    queryFn: async () => {
      if (!problemId) return [];
      const { data, error } = await supabase
        .from("problem_to_manoeuvre")
        .select("*")
        .eq("problem_id", problemId)
        .order("weight", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Manoeuvre[];
    },
    enabled: !!problemId,
  });
}
