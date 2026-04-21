import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Dossier } from "@/hooks/useDossier";
import { buildCalendarDescription, buildCalendarSummary } from "@/lib/calendar-event-helpers";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Calendar, Clock, Plus, Check, X, Send, Loader2, AlertTriangle,
} from "lucide-react";

interface SmartSlotSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dossier: Dossier;
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

function slotsOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(startB) < timeToMinutes(endA);
}

function findConflicts(date: string, start: string, end: string, confirmedRdvs: ConfirmedRdv[], currentDossierId: string): ConfirmedRdv[] {
  if (!date || !start || !end) return [];
  return confirmedRdvs.filter(
    (rdv) => rdv.id !== currentDossierId && rdv.appointment_date === date &&
      slotsOverlap(start, end, rdv.appointment_time_start, rdv.appointment_time_end),
  );
}

function getNextWorkdays(count: number): string[] {
  const days: string[] = [];
  const d = new Date();
  while (days.length < count) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) { // skip Sunday
      days.push(format(d, "yyyy-MM-dd"));
    }
  }
  return days;
}

function getRdvsForDate(date: string, confirmedRdvs: ConfirmedRdv[], currentDossierId: string): ConfirmedRdv[] {
  if (!date) return [];
  return confirmedRdvs.filter((r) => r.appointment_date === date && r.id !== currentDossierId);
}

export function SmartSlotSheet({ open, onOpenChange, dossier }: SmartSlotSheetProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Smart pre-fill: 3 next workdays with default times
  const defaultSlots = useMemo(() => {
    const workdays = getNextWorkdays(2);
    return [
      { date: workdays[0], start: "09:00", end: "11:00" },
      { date: workdays[0], start: "14:00", end: "16:00" },
      { date: workdays[1], start: "09:00", end: "11:00" },
    ];
  }, []);

  const [newSlots, setNewSlots] = useState(defaultSlots);
  const [manualDate, setManualDate] = useState("");
  const [manualStart, setManualStart] = useState("09:00");
  const [manualEnd, setManualEnd] = useState("11:00");

  // Reset slots when opening
  const handleOpenChange = (v: boolean) => {
    if (v) {
      const workdays = getNextWorkdays(2);
      setNewSlots([
        { date: workdays[0], start: "09:00", end: "11:00" },
        { date: workdays[0], start: "14:00", end: "16:00" },
        { date: workdays[1], start: "09:00", end: "11:00" },
      ]);
    }
    onOpenChange(v);
  };

  // Fetch confirmed RDVs
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
    enabled: !!user?.id && open,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["dossier", dossier.id] });
    queryClient.invalidateQueries({ queryKey: ["historique", dossier.id] });
    queryClient.invalidateQueries({ queryKey: ["appointment_slots", dossier.id] });
    queryClient.invalidateQueries({ queryKey: ["dossiers"] });
    queryClient.invalidateQueries({ queryKey: ["confirmed_rdvs", user?.id] });
  };

  const addHistorique = async (action: string, details: string) => {
    await supabase.from("historique").insert({
      dossier_id: dossier.id, user_id: user?.id ?? null, action, details,
    });
  };

  // Auto-sync to Google Calendar (best-effort).
  // Uses update_event if event_id exists; falls back to add_event on 404 or first-time sync.
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

  // Propose slots mutation
  const proposeSlots = useMutation({
    mutationFn: async () => {
      const validSlots = newSlots.filter((s) => s.date && s.start && s.end);
      if (!validSlots.length) throw new Error("Ajoutez au moins un créneau");

      const conflicts = validSlots.flatMap((s) =>
        findConflicts(s.date, s.start, s.end, confirmedRdvs, dossier.id).map((rdv) => ({ slot: s, rdv }))
      );
      if (conflicts.length > 0) {
        const details = conflicts.map((c) => {
          const name = [c.rdv.client_first_name, c.rdv.client_last_name].filter(Boolean).join(" ") || "un client";
          return `${c.slot.date} ${c.slot.start}–${c.slot.end} (conflit avec ${name})`;
        }).join(", ");
        throw new Error(`Conflit : ${details}`);
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
      } catch (e) { console.error("Notification error:", e); }
    },
    onSuccess: () => {
      toast({ title: "Créneaux envoyés ✅" });
      onOpenChange(false);
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  // Manual RDV mutation
  const setManualRdv = useMutation({
    mutationFn: async () => {
      if (!manualDate) throw new Error("Choisissez une date");
      const conflicts = findConflicts(manualDate, manualStart, manualEnd, confirmedRdvs, dossier.id);
      if (conflicts.length > 0) {
        const name = [conflicts[0].client_first_name, conflicts[0].client_last_name].filter(Boolean).join(" ") || "un client";
        throw new Error(`Conflit avec ${name} le ${manualDate} ${conflicts[0].appointment_time_start.slice(0, 5)}–${conflicts[0].appointment_time_end.slice(0, 5)}`);
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
      await addHistorique("rdv_confirmed", `RDV fixé manuellement : ${dateStr} ${manualStart}–${manualEnd}`);
      try {
        const fullAddress = dossier.address || [dossier.address_line, dossier.postal_code, dossier.city].filter(Boolean).join(", ");
        await sendNotification("APPOINTMENT_CONFIRMED", {
          appointment_date: dateStr,
          appointment_time: manualStart,
          appointment_time_end: manualEnd,
          address: fullAddress,
          raw_date: manualDate,
        });
      } catch (e) { console.error("Notification error:", e); }

      // Auto-sync to Google Calendar
      syncToGoogleCalendar(manualDate, manualStart, manualEnd);
    },
    onSuccess: () => {
      toast({ title: "Rendez-vous confirmé ✅" });
      onOpenChange(false);
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const addSlotRow = () => {
    if (newSlots.length >= 5) return;
    setNewSlots([...newSlots, { date: "", start: "09:00", end: "11:00" }]);
  };
  const removeSlotRow = (idx: number) => setNewSlots(newSlots.filter((_, i) => i !== idx));
  const updateSlotRow = (idx: number, field: string, value: string) =>
    setNewSlots(newSlots.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-5 w-5 text-primary" />
            Planifier un rendez-vous
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="propose" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="propose" className="flex-1 gap-1.5 text-xs">
              <Send className="h-3.5 w-3.5" /> Proposer créneaux
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex-1 gap-1.5 text-xs">
              <Calendar className="h-3.5 w-3.5" /> Fixer manuellement
            </TabsTrigger>
          </TabsList>

          {/* ─── PROPOSE SLOTS ─── */}
          <TabsContent value="propose" className="space-y-3 mt-3">
            <p className="text-xs text-muted-foreground">
              Créneaux pré-remplis intelligemment. Modifiez ou ajoutez selon vos disponibilités.
            </p>

            {newSlots.map((slot, idx) => {
              const slotConflicts = findConflicts(slot.date, slot.start, slot.end, confirmedRdvs, dossier.id);
              const dayRdvs = getRdvsForDate(slot.date, confirmedRdvs, dossier.id);

              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-[10px]">Date</Label>
                      <Input
                        type="date"
                        value={slot.date}
                        onChange={(e) => updateSlotRow(idx, "date", e.target.value)}
                        className={cn("h-9 text-xs", slotConflicts.length > 0 && "border-destructive")}
                      />
                    </div>
                    <div className="w-20 space-y-1">
                      <Label className="text-[10px]">Début</Label>
                      <Input
                        type="time"
                        value={slot.start}
                        onChange={(e) => updateSlotRow(idx, "start", e.target.value)}
                        className={cn("h-9 text-xs", slotConflicts.length > 0 && "border-destructive")}
                      />
                    </div>
                    <div className="w-20 space-y-1">
                      <Label className="text-[10px]">Fin</Label>
                      <Input
                        type="time"
                        value={slot.end}
                        onChange={(e) => updateSlotRow(idx, "end", e.target.value)}
                        className={cn("h-9 text-xs", slotConflicts.length > 0 && "border-destructive")}
                      />
                    </div>
                    {newSlots.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeSlotRow(idx)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* Conflict warning */}
                  {slotConflicts.length > 0 && (
                    <p className="text-[10px] text-destructive flex items-center gap-1 ml-1">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      Conflit : {[slotConflicts[0].client_first_name, slotConflicts[0].client_last_name].filter(Boolean).join(" ") || "un client"} ({slotConflicts[0].appointment_time_start.slice(0, 5)}–{slotConflicts[0].appointment_time_end.slice(0, 5)})
                    </p>
                  )}

                  {/* Day agenda preview */}
                  {dayRdvs.length > 0 && (
                    <div className="ml-1 flex flex-wrap gap-1">
                      {dayRdvs.map((r) => (
                        <span key={r.id} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {r.appointment_time_start.slice(0, 5)}–{r.appointment_time_end.slice(0, 5)} {[r.client_first_name, r.client_last_name].filter(Boolean).join(" ") || "Client"}
                        </span>
                      ))}
                    </div>
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

            <div className="flex gap-2 pt-2">
              <Button onClick={() => proposeSlots.mutate()} disabled={proposeSlots.isPending} className="flex-1 gap-2">
                {proposeSlots.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Envoyer au client
              </Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
            </div>
          </TabsContent>

          {/* ─── MANUAL RDV ─── */}
          <TabsContent value="manual" className="space-y-3 mt-3">
            {(() => {
              const manualConflicts = findConflicts(manualDate, manualStart, manualEnd, confirmedRdvs, dossier.id);
              const dayRdvs = getRdvsForDate(manualDate, confirmedRdvs, dossier.id);

              return (
                <>
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Date</Label>
                      <Input
                        type="date"
                        value={manualDate}
                        onChange={(e) => setManualDate(e.target.value)}
                        className={cn("h-9 text-xs", manualConflicts.length > 0 && "border-destructive")}
                      />
                    </div>
                    <div className="w-20 space-y-1">
                      <Label className="text-xs">Début</Label>
                      <Input type="time" value={manualStart} onChange={(e) => setManualStart(e.target.value)} className={cn("h-9 text-xs", manualConflicts.length > 0 && "border-destructive")} />
                    </div>
                    <div className="w-20 space-y-1">
                      <Label className="text-xs">Fin</Label>
                      <Input type="time" value={manualEnd} onChange={(e) => setManualEnd(e.target.value)} className={cn("h-9 text-xs", manualConflicts.length > 0 && "border-destructive")} />
                    </div>
                  </div>

                  {manualConflicts.length > 0 && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Conflit : {[manualConflicts[0].client_first_name, manualConflicts[0].client_last_name].filter(Boolean).join(" ") || "un client"} ({manualConflicts[0].appointment_time_start.slice(0, 5)}–{manualConflicts[0].appointment_time_end.slice(0, 5)})
                    </p>
                  )}

                  {/* Day agenda */}
                  {dayRdvs.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground font-medium">Déjà pris ce jour :</p>
                      <div className="flex flex-wrap gap-1">
                        {dayRdvs.map((r) => (
                          <span key={r.id} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {r.appointment_time_start.slice(0, 5)}–{r.appointment_time_end.slice(0, 5)} {[r.client_first_name, r.client_last_name].filter(Boolean).join(" ")}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => setManualRdv.mutate()}
                      disabled={setManualRdv.isPending || manualConflicts.length > 0}
                      className="flex-1 gap-2"
                    >
                      {setManualRdv.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Confirmer le RDV
                    </Button>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
                  </div>
                </>
              );
            })()}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
