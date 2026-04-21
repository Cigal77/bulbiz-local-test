import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;

export function useProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      // maybeSingle() retourne null au lieu de 406 si la ligne n'existe pas encore
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
    enabled: !!user?.id,
  });

  const update = useMutation({
    mutationFn: async (values: Partial<TablesUpdate<"profiles">>) => {
      // Exclude auto-managed columns that Postgres rejects in an upsert payload
      const { id, created_at, updated_at, ...safeValues } = values as any;

      const { error } = await supabase
        .from("profiles")
        .upsert(
          { ...safeValues, user_id: user!.id, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
  });

  return { profile: query.data, isLoading: query.isLoading, update };
}