import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Dossier = Tables<"dossiers">;
export type Historique = Tables<"historique">;
export type Media = Tables<"medias">;

export function useDossier(id: string) {
  return useQuery({
    queryKey: ["dossier", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dossiers")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Dossier | null;
    },
    enabled: !!id,
  });
}

export function useDossierHistorique(dossierId: string) {
  return useQuery({
    queryKey: ["historique", dossierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historique")
        .select("*")
        .eq("dossier_id", dossierId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Historique[];
    },
    enabled: !!dossierId,
  });
}

export function useDossierMedias(dossierId: string) {
  return useQuery({
    queryKey: ["medias", dossierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medias")
        .select("*")
        .eq("dossier_id", dossierId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Generate signed URLs for media files (bucket is private)
      const mediasWithUrls = await Promise.all(
        (data as Media[]).map(async (m) => {
          if (!m.file_url || m.media_category === "note") return m;
          // Check if it's already a full URL (legacy data) or a storage path
          if (m.file_url.startsWith("http")) return m;
          const { data: signedData } = await supabase.storage
            .from("dossier-medias")
            .createSignedUrl(m.file_url, 3600); // 1 hour expiry
          return { ...m, file_url: signedData?.signedUrl ?? m.file_url };
        })
      );
      return mediasWithUrls as Media[];
    },
    enabled: !!dossierId,
  });
}
