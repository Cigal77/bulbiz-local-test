import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useIngestSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sourceId: string) => {
      const { data, error } = await supabase.functions.invoke("ingest-catalog-source", {
        body: { source_id: sourceId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["data-sources"] });
      qc.invalidateQueries({ queryKey: ["ingestion-jobs"] });
      qc.invalidateQueries({ queryKey: ["catalog-material"] });
      const created = data?.items_created ?? 0;
      const updated = data?.items_updated ?? 0;
      toast.success(`Ingestion terminée : ${created} créé(s), ${updated} mis à jour`);
    },
    onError: (e: any) => {
      toast.error(`Erreur d'ingestion : ${e.message ?? e}`);
    },
  });
}
