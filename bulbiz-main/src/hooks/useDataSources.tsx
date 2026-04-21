import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DataSource {
  id: string;
  name: string;
  source_type: "website" | "pdf" | "csv" | "manual" | "supplier_feed" | "firecrawl";
  base_url: string | null;
  status: "idle" | "running" | "paused" | "error";
  config: Record<string, any>;
  last_sync_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface IngestionJob {
  id: string;
  data_source_id: string | null;
  status: "pending" | "running" | "completed" | "failed" | "partial";
  started_at: string | null;
  finished_at: string | null;
  items_found: number;
  items_created: number;
  items_updated: number;
  items_flagged: number;
  errors_json: any[];
  created_at: string;
}

export function useDataSources() {
  return useQuery({
    queryKey: ["data-sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_sources")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DataSource[];
    },
  });
}

export function useIngestionJobs(sourceId?: string) {
  return useQuery({
    queryKey: ["ingestion-jobs", sourceId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("ingestion_jobs").select("*").order("created_at", { ascending: false }).limit(50);
      if (sourceId) q = q.eq("data_source_id", sourceId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as IngestionJob[];
    },
  });
}

export function useUpsertDataSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<DataSource> & { id?: string }) => {
      const { id, ...rest } = payload;
      if (id) {
        const { error } = await supabase.from("data_sources").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("data_sources").insert(rest as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["data-sources"] });
      toast.success("Source enregistrée");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteDataSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("data_sources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["data-sources"] });
      toast.success("Source supprimée");
    },
  });
}
