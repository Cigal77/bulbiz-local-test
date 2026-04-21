import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Dossier = Tables<"dossiers">;

export type SortOption = "recent" | "activity" | "rdv_next" | "devis_oldest" | "invoice_oldest";

interface UseDossiersOptions {
  showTrash?: boolean;
}

export function useDossiers(options?: UseDossiersOptions) {
  const showTrash = options?.showTrash ?? false;

  return useQuery({
    queryKey: ["dossiers", { showTrash }],
    queryFn: async () => {
      let query = supabase
        .from("dossiers")
        .select("*")
        .order("created_at", { ascending: false });

      if (showTrash) {
        query = query.not("deleted_at", "is", null);
      } else {
        query = query.is("deleted_at", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Dossier[];
    },
  });
}
