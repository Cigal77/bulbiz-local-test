import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

type DossierStatus = Database["public"]["Enums"]["dossier_status"];

export interface DossierUpdatePayload {
  client_first_name?: string | null;
  client_last_name?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  address?: string | null;
  address_line?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  google_place_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  category?: Database["public"]["Enums"]["problem_category"];
  urgency?: Database["public"]["Enums"]["urgency_level"];
  description?: string | null;
}

export function useDossierActions(dossierId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["dossier", dossierId] });
    queryClient.invalidateQueries({ queryKey: ["historique", dossierId] });
    queryClient.invalidateQueries({ queryKey: ["dossiers"] });
  };

  const addHistorique = async (action: string, details?: string) => {
    await supabase.from("historique").insert({
      dossier_id: dossierId,
      user_id: user?.id ?? null,
      action,
      details,
    });
  };

  const changeStatus = useMutation({
    mutationFn: async (newStatus: DossierStatus) => {
      const { error } = await supabase
        .from("dossiers")
        .update({ status: newStatus, status_changed_at: new Date().toISOString() })
        .eq("id", dossierId);
      if (error) throw error;
      await addHistorique("status_change", `Statut changé en "${newStatus}"`);
    },
    onSuccess: invalidate,
  });

  const addNote = useMutation({
    mutationFn: async (note: string) => {
      await addHistorique("note", note);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["historique", dossierId] });
    },
  });

  const toggleRelance = useMutation({
    mutationFn: async (active: boolean) => {
      const { error } = await supabase
        .from("dossiers")
        .update({ relance_active: active })
        .eq("id", dossierId);
      if (error) throw error;
      await addHistorique("relance_toggle", active ? "Relances activées" : "Relances désactivées");
    },
    onSuccess: invalidate,
  });

  const sendRelance = useMutation({
    mutationFn: async (type: "info_manquante" | "devis_non_signe") => {
      const { data, error } = await supabase.functions.invoke("send-relance", {
        body: { dossier_id: dossierId, type },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: invalidate,
  });

  const updateDossier = useMutation({
    mutationFn: async ({ updates, changedFields }: { updates: DossierUpdatePayload; changedFields: string[] }) => {
      const { error } = await supabase
        .from("dossiers")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", dossierId);
      if (error) throw error;

      const details = changedFields.length > 0
        ? changedFields.join(", ")
        : "Informations mises à jour";
      await addHistorique("dossier_updated", details);

      // If a confirmed RDV exists and is synced to Google Calendar, refresh the
      // event silently so address / description / client name stay in sync.
      const calendarRelevantFields = [
        "address", "address_line", "postal_code", "city",
        "client_first_name", "client_last_name", "client_phone",
        "description", "category", "urgency",
      ];
      const needsResync = changedFields.some((f) => calendarRelevantFields.includes(f));
      if (needsResync) {
        try {
          const { data: d } = await supabase
            .from("dossiers")
            .select("*")
            .eq("id", dossierId)
            .maybeSingle();
          const eventId = (d as any)?.google_calendar_event_id as string | null | undefined;
          if (
            eventId &&
            (d as any)?.appointment_status === "rdv_confirmed" &&
            (d as any)?.appointment_date &&
            (d as any)?.appointment_time_start &&
            (d as any)?.appointment_time_end
          ) {
            const { buildCalendarSummary, buildCalendarDescription } = await import("@/lib/calendar-event-helpers");
            await supabase.functions.invoke("google-calendar", {
              body: {
                action: "update_event",
                event_id: eventId,
                dossier_id: dossierId,
                event: {
                  summary: buildCalendarSummary(d as any),
                  date: (d as any).appointment_date,
                  start_time: String((d as any).appointment_time_start).slice(0, 5),
                  end_time: String((d as any).appointment_time_end).slice(0, 5),
                  location: (d as any).address || [(d as any).address_line, (d as any).postal_code, (d as any).city].filter(Boolean).join(", "),
                  description: buildCalendarDescription(d as any),
                },
              },
            });
          }
        } catch {
          // Silent — Google Calendar resync is best-effort
        }
      }
    },
    onSuccess: invalidate,
  });

  const softDelete = useMutation({
    mutationFn: async (reason?: string) => {
      const { error } = await supabase
        .from("dossiers")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id ?? null,
          delete_reason: reason ?? null,
        })
        .eq("id", dossierId);
      if (error) throw error;
      await addHistorique("dossier_deleted", reason ? `Supprimé (${reason})` : "Dossier supprimé (corbeille)");
    },
    onSuccess: invalidate,
  });

  const restoreDossier = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("dossiers")
        .update({ deleted_at: null, deleted_by: null, delete_reason: null })
        .eq("id", dossierId);
      if (error) throw error;
      await addHistorique("dossier_restored", "Dossier restauré depuis la corbeille");
    },
    onSuccess: invalidate,
  });

  const permanentDelete = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("dossiers")
        .delete()
        .eq("id", dossierId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { changeStatus, addNote, toggleRelance, sendRelance, updateDossier, softDelete, restoreDossier, permanentDelete };
}
