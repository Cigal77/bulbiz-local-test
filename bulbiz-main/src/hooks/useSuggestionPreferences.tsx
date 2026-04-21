import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface SuggestionPreference {
  id: string;
  item_signature: string;
  intervention_id: string | null;
  is_hidden: boolean;
}

/** Normalise un libellé en signature stable. */
export function signatureFor(item: { id?: string | null; label?: string | null }): string {
  if (item.id) return item.id;
  return (item.label ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function useSuggestionPreferences(interventionId?: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["suggestion-prefs", user?.id],
    queryFn: async (): Promise<SuggestionPreference[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_suggestion_preference")
        .select("id, item_signature, intervention_id, is_hidden")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []) as SuggestionPreference[];
    },
    enabled: !!user,
    staleTime: 1000 * 30,
  });

  const hide = useMutation({
    mutationFn: async (item: { id?: string | null; label?: string | null }) => {
      if (!user) throw new Error("Not authenticated");
      const sig = signatureFor(item);
      const { error } = await supabase.from("user_suggestion_preference").upsert(
        {
          user_id: user.id,
          item_signature: sig,
          intervention_id: interventionId ?? null,
          is_hidden: true,
        },
        { onConflict: "user_id,item_signature,intervention_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suggestion-prefs", user?.id] });
      toast.success("Suggestion masquée", { description: "Tu ne la verras plus pour ce type d'intervention." });
    },
    onError: (e: any) => toast.error("Impossible de masquer", { description: e?.message }),
  });

  const unhide = useMutation({
    mutationFn: async (signature: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("user_suggestion_preference")
        .delete()
        .eq("user_id", user.id)
        .eq("item_signature", signature);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suggestion-prefs", user?.id] }),
  });

  const isHidden = (item: { id?: string | null; label?: string | null }): boolean => {
    const sig = signatureFor(item);
    return (query.data ?? []).some(
      (p) =>
        p.is_hidden &&
        p.item_signature === sig &&
        (p.intervention_id === null || p.intervention_id === interventionId),
    );
  };

  return { preferences: query.data ?? [], isLoading: query.isLoading, hide, unhide, isHidden };
}
