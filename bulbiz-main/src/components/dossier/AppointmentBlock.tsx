import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Dossier } from "@/hooks/useDossier";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_COLORS,
  type AppointmentStatus,
} from "@/lib/constants";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { downloadIcsFile, generateGoogleCalendarUrl, generateOutlookCalendarUrl } from "@/lib/ics-utils";
import { buildCalendarDescription, buildCalendarSummary } from "@/lib/calendar-event-helpers";
import {
  Calendar, Clock, Plus, Check, X, Send, Edit2, Loader2, AlertTriangle, CheckCircle2, RefreshCw, MapPin, Phone, Navigation, Receipt, CalendarPlus, Download,
} from "lucide-react";

interface AppointmentBlockProps {
  dossier: Dossier;
  onOpenSmartSheet?: () => void;
}

interface Slot {
  id: string;
  slot_date: string;
  time_start: string;
  time_end: string;
  selected_at: string | null;
}

interface ConfirmedRdv {
  id: string;
  appointment_date: string;
  appointment_time_start: string;
  appointment_time_end: string;
  client_first_name: string | null;
  client_last_name: string | null;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function slotsOverlap(
  startA: string, endA: string,
  startB: string, endB: string,
): boolean {
  return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(startB) < timeToMinutes(endA);
}

function findConflicts(
  date: string, start: string, end: string,
  confirmedRdvs: ConfirmedRdv[],
  currentDossierId: string,
): ConfirmedRdv[] {
  if (!date || !start || !end) return [];
  return confirmedRdvs.filter(
    (rdv) =>
      rdv.id !== currentDossierId &&
      rdv.appointment_date === date &&
      slotsOverlap(start, end, rdv.appointment_time_start, rdv.appointment_time_end),
  );
}

// Visual config per status
const STATUS_CONFIG: Record<string, { bg: string; border: string; iconColor: string; headerBg: string }> = {
  none: { bg: "bg-muted/30", border: "border-border", iconColor: "text-muted-foreground", headerBg: "bg-muted/50" },
  rdv_pending: { bg: "bg-warning/5", border: "border-warning/30", iconColor: "text-warning", headerBg: "bg-warning/10" },
  slots_proposed: { bg: "bg-blue-50 dark:bg-blue-950/20", border: "border-blue-200 dark:border-blue-800/40", iconColor: "text-blue-600 dark:text-blue-400", headerBg: "bg-blue-100/50 dark:bg-blue-900/20" },
  client_selected: { bg: "bg-orange-50 dark:bg-orange-950/20", border: "border-orange-200 dark:border-orange-800/40", iconColor: "text-orange-600 dark:text-orange-400", headerBg: "bg-orange-100/50 dark:bg-orange-900/20" },
  rdv_confirmed: { bg: "bg-success/5", border: "border-success/30", iconColor: "text-success", headerBg: "bg-success/10" },
  done: { bg: "bg-primary/5", border: "border-primary/30", iconColor: "text-primary", headerBg: "bg-primary/10" },
  cancelled: { bg: "bg-destructive/5", border: "border-destructive/20", iconColor: "text-destructive", headerBg: "bg-destructive/10" },
};

export function AppointmentBlock({ dossier, onOpenSmartSheet }: AppointmentBlockProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const status = ((dossier as any).appointment_status || "none") as AppointmentStatus;
  const appointmentDate = (dossier as any).appointment_date as string | null;
  const timeStart = (dossier as any).appointment_time_start as string | null;
  const timeEnd = (dossier as any).appointment_time_end as string | null;

  const [showSlotForm, setShowSlotForm] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [newSlots, setNewSlots] = useState<{ date: string; start: string; end: string }[]>([
    { date: "", start: "09:00", end: "11:00" },
  ]);
  const [manualDate, setManualDate] = useState("");
  const [manualStart, setManualStart] = useState("09:00");
  const [manualEnd, setManualEnd] = useState("11:00");
  const [resending, setResending] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const hasValidContact = !!(dossier.client_email || dossier.client_phone);
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.none;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["dossier", dossier.id] });
    queryClient.invalidateQueries({ queryKey: ["historique", dossier.id] });
    queryClient.invalidateQueries({ queryKey: ["appointment_slots", dossier.id] });
    queryClient.invalidateQueries({ queryKey: ["dossiers"] });
    queryClient.invalidateQueries({ queryKey: ["confirmed_rdvs", user?.id] });
  };

  // Fetch slots
  const { data: slots = [] } = useQuery({
    queryKey: ["appointment_slots", dossier.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_slots")
        .select("*")
        .eq("dossier_id", dossier.id)
        .order("slot_date", { ascending: true });
      if (error) throw error;
      return data as Slot[];
    },
  });

  // Fetch all confirmed RDVs for this artisan (across all dossiers)
  const { data: confirmedRdvs = [] } = useQuery({
    queryKey: ["confirmed_rdvs", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("dossiers")
        .select("id, appointment_date, appointment_time_start, appointment_time_end, client_first_name, client_last_name")
        .eq("user_id", user.id)
        .eq("appointment_status", "rdv_confirmed" as any)
        .not("appointment_date", "is", null);
      if (error) throw error;
      return (data || []) as ConfirmedRdv[];
    },
    enabled: !!user?.id,
  });

  const addHistorique = async (action: string, details: string) => {
    await supabase.from("historique").insert({
      dossier_id: dossier.id,
      user_id: user?.id ?? null,
      action,
      details,
    });
  };

  const sendNotification = async (eventType: string, extraPayload?: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("send-appointment-notification", {
      body: { event_type: eventType, dossier_id: dossier.id, payload: extraPayload || {} },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    if (data?.email_status === "FAILED") {
      toast({
        title: "⚠️ Email non envoyé au client",
        description: data.error_message || "La notification n'a pas pu partir. Préviens-le par téléphone.",
        variant: "destructive",
      });
    } else if (data?.email_status === "SKIPPED") {
      toast({
        title: "ℹ️ Email du client manquant",
        description: "Aucune notification envoyée — préviens-le par téléphone.",
      });
    } else if (data?.email_status === "SENT") {
      toast({ title: "✅ Email envoyé au client" });
    }
    return data;
  };

  // Auto-sync confirmed RDV to Google Calendar (best-effort).
  // If an event_id is already stored on the dossier → PATCH (update) instead of creating a new one.
  // If Google answers 404/410 (event deleted manually in Google) → fallback to creating a new one.
  const syncToGoogleCalendar = async (date: string, startTime: string, endTime: string) => {
    try {
      const existingEventId = (dossier as any).google_calendar_event_id as string | null | undefined;
      const eventPayload = {
        summary: buildCalendarSummary(dossier),
        date,
        start_time: startTime.slice(0, 5),
        end_time: endTime.slice(0, 5),
        location: dossier.address || [dossier.address_line, dossier.postal_code, dossier.city].filter(Boolean).join(", "),
        description: buildCalendarDescription(dossier),
      };

      if (existingEventId) {
        const { data: updData, error: updErr } = await supabase.functions.invoke("google-calendar", {
          body: { action: "update_event", event_id: existingEventId, dossier_id: dossier.id, event: eventPayload },
        });
        if (!updErr && updData?.success) {
          toast({ title: "📅 Google Agenda mis à jour" });
          return;
        }
        // If event was deleted in Google, fallthrough to add. Otherwise (other error), give up silently.
        if (!updData?.not_found) return;
      }

      const { data, error } = await supabase.functions.invoke("google-calendar", {
        body: { action: "add_event", dossier_id: dossier.id, event: eventPayload },
      });
      if (!error && data?.success && data?.event_id) {
        await supabase.from("dossiers").update({ google_calendar_event_id: data.event_id } as any).eq("id", dossier.id);
        toast({ title: "📅 RDV ajouté à Google Calendar" });
      }
    } catch {
      // Silent fail — Google Calendar is optional
    }
  };

  // Auto-delete event from Google Calendar (silent, best-effort)
  const deleteFromGoogleCalendar = async () => {
    try {
      const eventId = (dossier as any).google_calendar_event_id;
      if (!eventId) return;
      await supabase.functions.invoke("google-calendar", {
        body: { action: "delete_event", event_id: eventId, dossier_id: dossier.id },
      });
      await supabase.from("dossiers").update({ google_calendar_event_id: null } as any).eq("id", dossier.id);
    } catch {
      // Silent fail
    }
  };

  const handleResend = async (eventType: string) => {
    setResending(true);
    try {
      let extraPayload: Record<string, unknown> = {};
      if (eventType === "SLOTS_PROPOSED" && slots.length > 0) {
        const slotsText = slots.map(s =>
          `<p>• ${format(new Date(s.slot_date), "EEEE d MMMM", { locale: fr })} ${s.time_start.slice(0, 5)}–${s.time_end.slice(0, 5)}</p>`
        ).join("");
        extraPayload = { slots_text: slotsText };
        if (dossier.client_token) {
          extraPayload.appointment_link = `${window.location.origin}/client?token=${dossier.client_token}`;
        }
      }
      if (eventType === "APPOINTMENT_CONFIRMED" && appointmentDate) {
        const fullAddress = dossier.address || [dossier.address_line, dossier.postal_code, dossier.city].filter(Boolean).join(", ");
        extraPayload = {
          appointment_date: format(new Date(appointmentDate), "EEEE d MMMM yyyy", { locale: fr }),
          appointment_time: timeStart?.slice(0, 5) || "",
          appointment_time_end: timeEnd?.slice(0, 5) || "",
          address: fullAddress,
          raw_date: appointmentDate,
        };
      }
      await sendNotification(eventType, extraPayload);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setResending(false);
      invalidate();
    }
  };

  // Propose slots mutation
  const proposeSlots = useMutation({
    mutationFn: async () => {
      const validSlots = newSlots.filter((s) => s.date && s.start && s.end);
      if (!validSlots.length) throw new Error("Ajoutez au moins un créneau");

      // Check for conflicts with confirmed RDVs
      const conflicts = validSlots.flatMap((s) =>
        findConflicts(s.date, s.start, s.end, confirmedRdvs, dossier.id).map((rdv) => ({
          slot: s,
          rdv,
        }))
      );
      if (conflicts.length > 0) {
        const details = conflicts.map((c) => {
          const clientName = [c.rdv.client_first_name, c.rdv.client_last_name].filter(Boolean).join(" ") || "un client";
          return `${c.slot.date} ${c.slot.start}–${c.slot.end} (conflit avec RDV ${clientName})`;
        }).join(", ");
        throw new Error(`Conflit de créneaux : ${details}`);
      }

      const { error: slotErr } = await supabase.from("appointment_slots").insert(
        validSlots.map((s) => ({ dossier_id: dossier.id, slot_date: s.date, time_start: s.start, time_end: s.end }))
      );
      if (slotErr) throw slotErr;

      const { error: statusErr } = await supabase
        .from("dossiers")
        .update({ appointment_status: "slots_proposed" } as any)
        .eq("id", dossier.id);
      if (statusErr) throw statusErr;

      await addHistorique("slots_proposed", `${validSlots.length} créneau(x) proposé(s)`);

      const slotsText = validSlots.map(s => `<p>• ${s.date} ${s.start}–${s.end}</p>`).join("");
      let appointmentLink = "";
      if (dossier.client_token) appointmentLink = `${window.location.origin}/client?token=${dossier.client_token}`;

      try {
        await sendNotification("SLOTS_PROPOSED", { slots_text: slotsText, appointment_link: appointmentLink });
      } catch (e) {
        console.error("Notification error after slots proposed:", e);
      }
    },
    onSuccess: () => {
      setShowSlotForm(false);
      setNewSlots([{ date: "", start: "09:00", end: "11:00" }]);
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  // Manual RDV mutation
  const setManualRdv = useMutation({
    mutationFn: async () => {
      if (!manualDate) throw new Error("Choisissez une date");

      // Check for conflicts with confirmed RDVs
      const conflicts = findConflicts(manualDate, manualStart, manualEnd, confirmedRdvs, dossier.id);
      if (conflicts.length > 0) {
        const clientName = [conflicts[0].client_first_name, conflicts[0].client_last_name].filter(Boolean).join(" ") || "un client";
        throw new Error(`Conflit : vous avez déjà un RDV avec ${clientName} le ${manualDate} de ${conflicts[0].appointment_time_start.slice(0, 5)} à ${conflicts[0].appointment_time_end.slice(0, 5)}`);
      }

      const { error } = await supabase
        .from("dossiers")
        .update({
          status: "rdv_pris", status_changed_at: new Date().toISOString(),
          appointment_status: "rdv_confirmed", appointment_date: manualDate,
          appointment_time_start: manualStart, appointment_time_end: manualEnd,
          appointment_source: "manual", appointment_confirmed_at: new Date().toISOString(),
        } as any)
        .eq("id", dossier.id);
      if (error) throw error;

      const dateStr = format(new Date(manualDate), "EEEE d MMMM yyyy", { locale: fr });
      await addHistorique("rdv_confirmed", `Rendez-vous fixé manuellement : ${dateStr} ${manualStart}–${manualEnd}`);

      try {
        const fullAddress = dossier.address || [dossier.address_line, dossier.postal_code, dossier.city].filter(Boolean).join(", ");
        await sendNotification("APPOINTMENT_CONFIRMED", {
          appointment_date: dateStr,
          appointment_time: manualStart,
          appointment_time_end: manualEnd,
          address: fullAddress,
          raw_date: manualDate,
        });
      } catch (e) {
        console.error("Notification error after manual rdv:", e);
      }

      // Auto-sync to Google Calendar
      syncToGoogleCalendar(manualDate, manualStart, manualEnd);
    },
    onSuccess: () => {
      toast({ title: "Rendez-vous confirmé ✅" });
      setShowManualForm(false);
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  // Confirm selected slot
  const confirmSlot = useMutation({
    mutationFn: async () => {
      const selected = slots.find((s) => s.selected_at);
      if (!selected) throw new Error("Aucun créneau sélectionné par le client");

      // Check for conflicts with confirmed RDVs
      const conflicts = findConflicts(selected.slot_date, selected.time_start, selected.time_end, confirmedRdvs, dossier.id);
      if (conflicts.length > 0) {
        const clientName = [conflicts[0].client_first_name, conflicts[0].client_last_name].filter(Boolean).join(" ") || "un client";
        throw new Error(`Conflit : vous avez déjà un RDV avec ${clientName} le ${selected.slot_date} de ${conflicts[0].appointment_time_start.slice(0, 5)} à ${conflicts[0].appointment_time_end.slice(0, 5)}`);
      }

      const { error } = await supabase
        .from("dossiers")
        .update({
          status: "rdv_pris", status_changed_at: new Date().toISOString(),
          appointment_status: "rdv_confirmed", appointment_date: selected.slot_date,
          appointment_time_start: selected.time_start, appointment_time_end: selected.time_end,
          appointment_source: "client_selected", appointment_confirmed_at: new Date().toISOString(),
        } as any)
        .eq("id", dossier.id);
      if (error) throw error;

      const dateStr = format(new Date(selected.slot_date), "EEEE d MMMM yyyy", { locale: fr });
      await addHistorique("rdv_confirmed", `Rendez-vous confirmé : ${dateStr} ${selected.time_start}–${selected.time_end}`);

      try {
        const fullAddress2 = dossier.address || [dossier.address_line, dossier.postal_code, dossier.city].filter(Boolean).join(", ");
        await sendNotification("APPOINTMENT_CONFIRMED", {
          appointment_date: dateStr,
          appointment_time: selected.time_start.slice(0, 5),
          appointment_time_end: selected.time_end.slice(0, 5),
          address: fullAddress2,
          raw_date: selected.slot_date,
        });
      } catch (e) {
        console.error("Notification error after confirm slot:", e);
      }

      // Auto-sync to Google Calendar
      syncToGoogleCalendar(selected.slot_date, selected.time_start, selected.time_end);
    },
    onSuccess: () => { toast({ title: "Rendez-vous confirmé ✅" }); invalidate(); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  // Confirm a proposed slot (artisan picks from list)
  const confirmProposedSlot = useMutation({
    mutationFn: async () => {
      if (!selectedSlotId) throw new Error("Sélectionnez un créneau");
      const slot = slots.find((s) => s.id === selectedSlotId);
      if (!slot) throw new Error("Créneau introuvable");

      const conflicts = findConflicts(slot.slot_date, slot.time_start, slot.time_end, confirmedRdvs, dossier.id);
      if (conflicts.length > 0) {
        const clientName = [conflicts[0].client_first_name, conflicts[0].client_last_name].filter(Boolean).join(" ") || "un client";
        throw new Error(`Conflit : vous avez déjà un RDV avec ${clientName} le ${slot.slot_date} de ${conflicts[0].appointment_time_start.slice(0, 5)} à ${conflicts[0].appointment_time_end.slice(0, 5)}`);
      }

      const { error } = await supabase
        .from("dossiers")
        .update({
          status: "rdv_pris", status_changed_at: new Date().toISOString(),
          appointment_status: "rdv_confirmed", appointment_date: slot.slot_date,
          appointment_time_start: slot.time_start, appointment_time_end: slot.time_end,
          appointment_source: "manual", appointment_confirmed_at: new Date().toISOString(),
        } as any)
        .eq("id", dossier.id);
      if (error) throw error;

      const dateStr = format(new Date(slot.slot_date), "EEEE d MMMM yyyy", { locale: fr });
      await addHistorique("rdv_confirmed", `Créneau confirmé par l'artisan : ${dateStr} ${slot.time_start.slice(0, 5)}–${slot.time_end.slice(0, 5)}`);

      try {
        const fullAddress = dossier.address || [dossier.address_line, dossier.postal_code, dossier.city].filter(Boolean).join(", ");
        await sendNotification("APPOINTMENT_CONFIRMED", {
          appointment_date: dateStr,
          appointment_time: slot.time_start.slice(0, 5),
          appointment_time_end: slot.time_end.slice(0, 5),
          address: fullAddress,
          raw_date: slot.slot_date,
        });
      } catch (e) {
        console.error("Notification error after confirm proposed slot:", e);
      }

      syncToGoogleCalendar(slot.slot_date, slot.time_start, slot.time_end);
    },
    onSuccess: () => {
      toast({ title: "Rendez-vous confirmé ✅" });
      setSelectedSlotId(null);
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  // Cancel RDV
  const cancelRdv = useMutation({
    mutationFn: async () => {
      // Auto-delete from Google Calendar before cancelling
      await deleteFromGoogleCalendar();

      const { error } = await supabase
        .from("dossiers")
        .update({ appointment_status: "cancelled", appointment_date: null, appointment_time_start: null, appointment_time_end: null, appointment_confirmed_at: null, google_calendar_event_id: null } as any)
        .eq("id", dossier.id);
      if (error) throw error;
      await addHistorique("rdv_cancelled", "Rendez-vous annulé");
    },
    onSuccess: () => { toast({ title: "Rendez-vous annulé" }); invalidate(); },
  });

  // Mark intervention as done
  const markDone = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("dossiers")
        .update({ status: "rdv_termine", status_changed_at: new Date().toISOString(), appointment_status: "done" } as any)
        .eq("id", dossier.id);
      if (error) throw error;
      await addHistorique("intervention_done", "Intervention marquée comme réalisée");
    },
    onSuccess: () => { toast({ title: "Intervention réalisée ✅" }); invalidate(); },
  });

  const addSlotRow = () => {
    if (newSlots.length >= 5) return;
    setNewSlots([...newSlots, { date: "", start: "09:00", end: "11:00" }]);
  };
  const removeSlotRow = (idx: number) => setNewSlots(newSlots.filter((_, i) => i !== idx));
  const updateSlotRow = (idx: number, field: string, value: string) =>
    setNewSlots(newSlots.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));

  const selectedSlot = slots.find((s) => s.selected_at);

  const resendEventMap: Partial<Record<AppointmentStatus, { label: string; event: string }>> = {
    slots_proposed: { label: "Renvoyer le lien", event: "SLOTS_PROPOSED" },
    client_selected: { label: "Renvoyer le lien", event: "SLOTS_PROPOSED" },
    rdv_confirmed: { label: "Renvoyer la confirmation", event: "APPOINTMENT_CONFIRMED" },
  };
  const resendInfo = resendEventMap[status];

  // Navigation helpers
  const address = dossier.address;
  const lat = (dossier as any).lat;
  const lng = (dossier as any).lng;
  const hasCoords = lat && lng;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn("rounded-xl border-2 p-5 space-y-4", config.bg, config.border)}
    >
      {/* Header */}
      <div className={cn("flex items-center justify-between rounded-lg px-3 py-2 -mx-1 -mt-1", config.headerBg)}>
        <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
          <motion.div
            animate={status === "none" || status === "rdv_pending" ? { scale: [1, 1.15, 1] } : {}}
            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3 }}
          >
            <Calendar className={cn("h-5 w-5", config.iconColor)} />
          </motion.div>
          <span className={config.iconColor}>Rendez-vous</span>
        </h3>
        <Badge className={cn("text-[10px] font-semibold", APPOINTMENT_STATUS_COLORS[status])}>
          {APPOINTMENT_STATUS_LABELS[status]}
        </Badge>
      </div>

      {/* ─── CONFIRMED RDV ─── */}
      {status === "rdv_confirmed" && appointmentDate && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="rounded-lg bg-success/10 border border-success/20 p-4 space-y-3"
        >
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-success shrink-0 mt-0.5" />
            <div>
              <p className="text-base font-bold text-foreground capitalize">
                {format(new Date(appointmentDate), "EEEE d MMMM yyyy", { locale: fr })}
              </p>
              {timeStart && timeEnd && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="h-3.5 w-3.5" />
                  {timeStart.slice(0, 5)} – {timeEnd.slice(0, 5)}
                </p>
              )}
            </div>
          </div>
          {/* Quick navigation + calendar links */}
          <div className="flex flex-wrap gap-2">
            {hasCoords && (
              <>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                  <a href={`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`} target="_blank" rel="noopener noreferrer">
                    <Navigation className="h-3.5 w-3.5" /> Waze
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} target="_blank" rel="noopener noreferrer">
                    <MapPin className="h-3.5 w-3.5" /> Maps
                  </a>
                </Button>
              </>
            )}
            {!hasCoords && address && (
              <>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                  <a href={`https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`} target="_blank" rel="noopener noreferrer">
                    <Navigation className="h-3.5 w-3.5" /> Waze
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer">
                    <MapPin className="h-3.5 w-3.5" /> Maps
                  </a>
                </Button>
              </>
            )}
            {dossier.client_phone && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                <a href={`tel:${dossier.client_phone}`}>
                  <Phone className="h-3.5 w-3.5" /> Appeler
                </a>
              </Button>
            )}

            {/* Calendar dropdown */}
            {appointmentDate && timeStart && timeEnd && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                    <CalendarPlus className="h-3.5 w-3.5" /> Agenda
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => {
                    downloadIcsFile({
                      title: buildCalendarSummary(dossier),
                      startDate: appointmentDate,
                      startTime: timeStart,
                      endTime: timeEnd,
                      location: dossier.address || [dossier.address_line, dossier.postal_code, dossier.city].filter(Boolean).join(", ") || undefined,
                      description: buildCalendarDescription(dossier),
                      uid: dossier.id,
                    });
                  }}>
                    <Download className="h-4 w-4 mr-2" />
                    Télécharger .ics
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href={generateGoogleCalendarUrl({
                      title: buildCalendarSummary(dossier),
                      startDate: appointmentDate,
                      startTime: timeStart,
                      endTime: timeEnd,
                      location: dossier.address || [dossier.address_line, dossier.postal_code, dossier.city].filter(Boolean).join(", ") || undefined,
                      description: buildCalendarDescription(dossier),
                    })} target="_blank" rel="noopener noreferrer">
                      <Calendar className="h-4 w-4 mr-2" />
                      Google Calendar
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href={generateOutlookCalendarUrl({
                      title: buildCalendarSummary(dossier),
                      startDate: appointmentDate,
                      startTime: timeStart,
                      endTime: timeEnd,
                      location: dossier.address || [dossier.address_line, dossier.postal_code, dossier.city].filter(Boolean).join(", ") || undefined,
                      description: buildCalendarDescription(dossier),
                    })} target="_blank" rel="noopener noreferrer">
                      <Calendar className="h-4 w-4 mr-2" />
                      Outlook
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={async () => {
                    try {
                      // Use the unified sync function: PATCH if event_id exists, else POST.
                      await syncToGoogleCalendar(appointmentDate, timeStart, timeEnd);
                      invalidate();
                    } catch (e: any) {
                      if (e.message?.includes("non connecté")) {
                        toast({ title: "Google Calendar non connecté", description: "Connectez-le dans les paramètres.", variant: "destructive" });
                      } else {
                        toast({ title: "Erreur", description: e.message, variant: "destructive" });
                      }
                    }
                  }}>
                    <CalendarPlus className="h-4 w-4 mr-2" />
                    Synchro auto (Google)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </motion.div>
      )}

      {/* ─── DONE ─── */}
      {status === "done" && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-lg bg-primary/10 border border-primary/20 p-4 space-y-2"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <p className="text-base font-bold text-primary">Intervention réalisée</p>
          </div>
          {appointmentDate && (
            <p className="text-sm text-muted-foreground ml-7">
              Le {format(new Date(appointmentDate), "d MMMM yyyy", { locale: fr })}
              {timeStart && timeEnd ? ` — ${timeStart.slice(0, 5)}–${timeEnd.slice(0, 5)}` : ""}
            </p>
          )}
        </motion.div>
      )}

      {/* ─── CLIENT SELECTED ─── */}
      {status === "client_selected" && selectedSlot && (
        <div className="rounded-lg bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/30 p-3 space-y-2">
          <p className="text-sm font-medium text-foreground">
            Le client a choisi : {format(new Date(selectedSlot.slot_date), "EEEE d MMMM", { locale: fr })} {selectedSlot.time_start.slice(0, 5)}–{selectedSlot.time_end.slice(0, 5)}
          </p>
        </div>
      )}

      {/* ─── NO RDV — dans le bloc (status === "none" || status === "cancelled") ─── */}
      <div className="flex flex-col sm:flex-row gap-2">
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} className="flex-1">
          <Button
            className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md text-sm h-11 px-2"
            onClick={() => onOpenSmartSheet ? onOpenSmartSheet() : setShowManualForm(true)}
          >
            <Calendar className="h-4 w-4 shrink-0" />
            <span className="truncate">Fixer un rendez-vous</span>
          </Button>
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} className="flex-1">
          <Button variant="outline" className="w-full gap-2 h-11 text-sm px-2" onClick={() => onOpenSmartSheet ? onOpenSmartSheet() : setShowSlotForm(true)}>
            <Send className="h-4 w-4 shrink-0" />
            <span className="truncate">Proposer des créneaux</span>
          </Button>
        </motion.div>
      </div>
      {/* ─── PENDING — waiting action ─── */}
      {status === "rdv_pending" && (
        <div className="text-center py-2 space-y-3">
          <div className="flex items-center justify-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <p className="text-sm font-medium text-foreground">Créneaux à proposer au client</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} className="flex-1">
              <Button className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md h-11" onClick={() => onOpenSmartSheet ? onOpenSmartSheet() : setShowSlotForm(true)}>
                <Send className="h-4 w-4" /> Proposer des créneaux
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} className="flex-1">
              <Button variant="outline" className="w-full gap-2 h-11" onClick={() => onOpenSmartSheet ? onOpenSmartSheet() : setShowManualForm(true)}>
                <Edit2 className="h-4 w-4" /> Fixer manuellement
              </Button>
            </motion.div>
          </div>
        </div>
      )}

      {/* Proposed slots list — interactive for slots_proposed */}
      {status === "slots_proposed" && slots.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium">Choisissez un créneau à confirmer :</p>
          {slots.map((slot) => (
            <button
              key={slot.id}
              type="button"
              onClick={() => setSelectedSlotId(slot.id === selectedSlotId ? null : slot.id)}
              className={cn(
                "w-full text-xs rounded px-2.5 py-2 flex items-center gap-2 text-left transition-colors border",
                slot.id === selectedSlotId
                  ? "bg-primary/10 border-primary text-primary font-medium"
                  : "bg-muted border-transparent text-muted-foreground hover:bg-muted/80"
              )}
            >
              <div className={cn(
                "h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center",
                slot.id === selectedSlotId ? "border-primary" : "border-muted-foreground/40"
              )}>
                {slot.id === selectedSlotId && <div className="h-2 w-2 rounded-full bg-primary" />}
              </div>
              {format(new Date(slot.slot_date), "EEE d MMM", { locale: fr })} {slot.time_start.slice(0, 5)}–{slot.time_end.slice(0, 5)}
              {slot.selected_at && <Badge variant="outline" className="ml-auto text-[9px] px-1.5 py-0">Choix client</Badge>}
            </button>
          ))}
        </div>
      )}

      {/* Static slot list for client_selected */}
      {status === "client_selected" && slots.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium">Créneaux proposés :</p>
          {slots.map((slot) => (
            <div key={slot.id} className={cn("text-xs rounded px-2.5 py-1.5 flex items-center gap-2", slot.selected_at ? "bg-primary/10 text-primary font-medium" : "bg-muted text-muted-foreground")}>
              {format(new Date(slot.slot_date), "EEE d MMM", { locale: fr })} {slot.time_start.slice(0, 5)}–{slot.time_end.slice(0, 5)}
              {slot.selected_at && <Check className="h-3 w-3" />}
            </div>
          ))}
        </div>
      )}

      {/* Action buttons for slots_proposed / client_selected / rdv_confirmed */}
      <div className="flex flex-col gap-2">
        {status === "slots_proposed" && (
          <div className="flex flex-col gap-2">
            {selectedSlotId && (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                <Button className="w-full gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11" onClick={() => confirmProposedSlot.mutate()} disabled={confirmProposedSlot.isPending}>
                  {confirmProposedSlot.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Confirmer ce créneau
                </Button>
              </motion.div>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" className="flex-1 gap-1.5" onClick={() => onOpenSmartSheet ? onOpenSmartSheet() : setShowSlotForm(true)}>
                <Plus className="h-3.5 w-3.5" /> Proposer d'autres créneaux
              </Button>
              <Button variant="outline" className="flex-1 gap-1.5" onClick={() => onOpenSmartSheet ? onOpenSmartSheet() : setShowManualForm(true)}>
                <Edit2 className="h-3.5 w-3.5" /> Fixer manuellement
              </Button>
            </div>
          </div>
        )}

        {status === "client_selected" && (
          <div className="flex flex-col sm:flex-row gap-2">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} className="flex-1">
              <Button className="w-full gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11" onClick={() => confirmSlot.mutate()} disabled={confirmSlot.isPending}>
                {confirmSlot.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Confirmer le rendez-vous
              </Button>
            </motion.div>
            <Button variant="outline" className="flex-1 gap-1.5" onClick={() => onOpenSmartSheet ? onOpenSmartSheet() : setShowSlotForm(true)}>
              <Plus className="h-3.5 w-3.5" /> Autres créneaux
            </Button>
          </div>
        )}

        {status === "rdv_confirmed" && (
          <div className="flex flex-col sm:flex-row gap-2">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} className="flex-1">
              <Button className="w-full gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11" onClick={() => markDone.mutate()} disabled={markDone.isPending}>
                {markDone.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Intervention réalisée
              </Button>
            </motion.div>
            <Button variant="outline" className="flex-1 gap-1.5" onClick={() => onOpenSmartSheet ? onOpenSmartSheet() : setShowManualForm(true)}>
              <Edit2 className="h-3.5 w-3.5" /> Modifier
            </Button>
            <Button variant="outline" className="gap-1.5 text-destructive" onClick={() => cancelRdv.mutate()} disabled={cancelRdv.isPending}>
              <X className="h-3.5 w-3.5" /> Annuler
            </Button>
          </div>
        )}

        {status === "done" && (
          <Button variant="outline" className="w-full gap-1.5" onClick={() => window.dispatchEvent(new CustomEvent("open-import-facture"))}>
            <Receipt className="h-3.5 w-3.5" /> Importer facture
          </Button>
        )}

        {/* Resend notification */}
        {resendInfo && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Button variant="ghost" size="sm" className="w-full gap-1.5 text-xs text-muted-foreground" onClick={() => handleResend(resendInfo.event)} disabled={resending || !hasValidContact}>
                  {resending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  {resendInfo.label}
                </Button>
              </div>
            </TooltipTrigger>
            {!hasValidContact && (
              <TooltipContent><p>Ajoutez un email ou téléphone client pour envoyer</p></TooltipContent>
            )}
          </Tooltip>
        )}
      </div>

      {/* Slot proposal form */}
      {showSlotForm && (
        <div className="border border-border rounded-lg p-3 space-y-3 bg-background">
          <p className="text-xs font-medium text-foreground">Ajouter des créneaux (max 5)</p>
          {newSlots.map((slot, idx) => {
            const slotConflicts = findConflicts(slot.date, slot.start, slot.end, confirmedRdvs, dossier.id);
            return (
              <div key={idx} className="space-y-1">
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-[10px]">Date</Label>
                    <Input type="date" value={slot.date} onChange={(e) => updateSlotRow(idx, "date", e.target.value)} className={cn("h-8 text-xs", slotConflicts.length > 0 && "border-destructive")} />
                  </div>
                  <div className="w-18 space-y-1">
                    <Label className="text-[10px]">Début</Label>
                    <Input type="time" value={slot.start} onChange={(e) => updateSlotRow(idx, "start", e.target.value)} className={cn("h-8 text-xs", slotConflicts.length > 0 && "border-destructive")} />
                  </div>
                  <div className="w-18 space-y-1">
                    <Label className="text-[10px]">Fin</Label>
                    <Input type="time" value={slot.end} onChange={(e) => updateSlotRow(idx, "end", e.target.value)} className={cn("h-8 text-xs", slotConflicts.length > 0 && "border-destructive")} />
                  </div>
                  {newSlots.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeSlotRow(idx)}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {slotConflicts.length > 0 && (
                  <p className="text-[10px] text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Conflit : RDV avec {[slotConflicts[0].client_first_name, slotConflicts[0].client_last_name].filter(Boolean).join(" ") || "un client"} ({slotConflicts[0].appointment_time_start.slice(0, 5)}–{slotConflicts[0].appointment_time_end.slice(0, 5)})
                  </p>
                )}
              </div>
            );
          })}
          <div className="flex gap-2">
            {newSlots.length < 5 && (
              <Button variant="ghost" size="sm" onClick={addSlotRow} className="gap-1 text-xs">
                <Plus className="h-3 w-3" /> Ajouter créneau
              </Button>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={() => proposeSlots.mutate()} disabled={proposeSlots.isPending}>
              {proposeSlots.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Envoyer"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowSlotForm(false)}>Annuler</Button>
          </div>
        </div>
      )}

      {/* Manual RDV form — simplified */}
      {showManualForm && (() => {
        const manualConflicts = findConflicts(manualDate, manualStart, manualEnd, confirmedRdvs, dossier.id);
        return (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="border border-border rounded-lg p-3 space-y-3 bg-background"
          >
            <p className="text-sm font-bold text-foreground flex items-center gap-2 leading-tight">
              <Calendar className="h-4 w-4 text-primary" />
              Fixer un rendez-vous
            </p>
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} className={cn("h-8 text-xs", manualConflicts.length > 0 && "border-destructive")} />
              </div>
              <div className="w-18 space-y-1">
                <Label className="text-xs">Début</Label>
                <Input type="time" value={manualStart} onChange={(e) => setManualStart(e.target.value)} className={cn("h-8 text-xs", manualConflicts.length > 0 && "border-destructive")} />
              </div>
              <div className="w-18 space-y-1">
                <Label className="text-xs">Fin</Label>
                <Input type="time" value={manualEnd} onChange={(e) => setManualEnd(e.target.value)} className={cn("h-8 text-xs", manualConflicts.length > 0 && "border-destructive")} />
              </div>
            </div>
            {manualConflicts.length > 0 && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Conflit : RDV avec {[manualConflicts[0].client_first_name, manualConflicts[0].client_last_name].filter(Boolean).join(" ") || "un client"} ({manualConflicts[0].appointment_time_start.slice(0, 5)}–{manualConflicts[0].appointment_time_end.slice(0, 5)})
              </p>
            )}
            <div className="flex gap-2">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                <Button onClick={() => setManualRdv.mutate()} disabled={setManualRdv.isPending || manualConflicts.length > 0} className="gap-2">
                  {setManualRdv.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Confirmer
                </Button>
              </motion.div>
              <Button variant="ghost" onClick={() => setShowManualForm(false)}>Annuler</Button>
            </div>
          </motion.div>
        );
      })()}
    </motion.div>
  );
}
