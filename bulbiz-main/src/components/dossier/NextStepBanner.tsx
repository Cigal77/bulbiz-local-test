import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useInvoices } from "@/hooks/useInvoices";
import { useQuotes } from "@/hooks/useQuotes";
import type { Dossier } from "@/hooks/useDossier";
import type { AppointmentStatus } from "@/lib/constants";
import { format, differenceInHours, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Calendar, Send, CheckCircle2, FileText, Receipt, Loader2, ArrowRight, Sparkles,
  CreditCard, Link2, AlertCircle, Clock, Phone, Mic, Camera, PenLine, RefreshCw,
} from "lucide-react";

interface NextStepBannerProps {
  dossier: Dossier;
  onScrollToAppointment?: () => void;
}

interface ActionCard {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  isPending?: boolean;
  variant: "primary" | "secondary" | "subtle";
  pulse?: boolean;
}

export function NextStepBanner({ dossier, onScrollToAppointment }: NextStepBannerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const appointmentStatus = ((dossier as any).appointment_status || "none") as AppointmentStatus;
  const { data: invoices = [] } = useInvoices(dossier.id);
  const { data: quotes = [] } = useQuotes(dossier.id);

  const [showManualRdv, setShowManualRdv] = useState(false);
  const [manualDate, setManualDate] = useState("");
  const [manualStart, setManualStart] = useState("09:00");
  const [manualEnd, setManualEnd] = useState("11:00");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["dossier", dossier.id] });
    queryClient.invalidateQueries({ queryKey: ["historique", dossier.id] });
    queryClient.invalidateQueries({ queryKey: ["dossiers"] });
  };

  // ── Mutations ──
  const setManualRdv = useMutation({
    mutationFn: async () => {
      if (!manualDate) throw new Error("Choisissez une date");
      const { error } = await supabase
        .from("dossiers")
        .update({
          status: "rdv_pris",
          status_changed_at: new Date().toISOString(),
          appointment_status: "rdv_confirmed",
          appointment_date: manualDate,
          appointment_time_start: manualStart,
          appointment_time_end: manualEnd,
          appointment_source: "manual",
          appointment_confirmed_at: new Date().toISOString(),
        } as any)
        .eq("id", dossier.id);
      if (error) throw error;

      const dateStr = format(new Date(manualDate), "EEEE d MMMM yyyy", { locale: fr });
      await supabase.from("historique").insert({
        dossier_id: dossier.id,
        user_id: user?.id ?? null,
        action: "rdv_confirmed",
        details: `Rendez-vous fixé manuellement : ${dateStr} ${manualStart}–${manualEnd}`,
      });

      try {
        await supabase.functions.invoke("send-appointment-notification", {
          body: {
            event_type: "APPOINTMENT_CONFIRMED",
            dossier_id: dossier.id,
            payload: {
              appointment_date: dateStr,
              appointment_time: manualStart,
              appointment_time_end: manualEnd,
              raw_date: manualDate,
              address: dossier.address || [dossier.address_line, dossier.postal_code, dossier.city].filter(Boolean).join(", "),
            },
          },
        });
      } catch (e) {
        console.error("Notification error:", e);
      }
    },
    onSuccess: () => {
      toast({ title: "Rendez-vous confirmé ✅" });
      setShowManualRdv(false);
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const markDone = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("dossiers")
        .update({
          status: "rdv_termine",
          status_changed_at: new Date().toISOString(),
          appointment_status: "done",
        } as any)
        .eq("id", dossier.id);
      if (error) throw error;
      await supabase.from("historique").insert({
        dossier_id: dossier.id,
        user_id: user?.id ?? null,
        action: "intervention_done",
        details: "Intervention marquée comme réalisée",
      });
    },
    onSuccess: () => {
      toast({ title: "Intervention réalisée ✅" });
      invalidate();
    },
  });

  const markPaid = useMutation({
    mutationFn: async () => {
      if (invoices.length === 0) throw new Error("Aucune facture");
      const inv = invoices[0];
      const { error: invErr } = await supabase
        .from("invoices")
        .update({ status: "paid", paid_at: new Date().toISOString() } as any)
        .eq("id", inv.id);
      if (invErr) throw invErr;

      const { error } = await supabase
        .from("dossiers")
        .update({ status: "invoice_paid", status_changed_at: new Date().toISOString() })
        .eq("id", dossier.id);
      if (error) throw error;

      await supabase.from("historique").insert({
        dossier_id: dossier.id,
        user_id: user?.id ?? null,
        action: "invoice_paid",
        details: `Facture ${inv.invoice_number} marquée comme payée`,
      });
    },
    onSuccess: () => {
      toast({ title: "Facture marquée payée ✅" });
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["invoices", dossier.id] });
    },
  });

  const sendClientLink = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("send-client-link", {
        body: { dossier_id: dossier.id },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Lien envoyé au client ✅" });
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  // ── Missing info detection ──
  const missingFields: string[] = [];
  if (!dossier.client_email) missingFields.push("email");
  if (!dossier.client_phone) missingFields.push("téléphone");
  if (!dossier.address && !dossier.address_line) missingFields.push("adresse");
  const hasIncompleteInfo = missingFields.length > 0;

  // ── Time counter ──
  const getTimeCounter = (): { text: string; color: "muted" | "warning" | "destructive" } | null => {
    const now = new Date();
    const status = dossier.status;
    const noCounterStatuses = ["nouveau", "a_qualifier", "rdv_termine", "devis_a_faire", "invoice_paid", "clos_perdu", "clos_signe"];
    if (noCounterStatuses.includes(status)) return null;

    if (status === "en_attente_rdv") return formatCounter("En attente", new Date(dossier.status_changed_at), now);
    if (status === "rdv_pris") {
      const appointmentDate = (dossier as any).appointment_date;
      if (appointmentDate) {
        const rdvDate = new Date(appointmentDate);
        const hoursUntil = differenceInHours(rdvDate, now);
        const daysUntil = differenceInDays(rdvDate, now);
        if (hoursUntil < 0) return { text: `RDV passé depuis ${Math.abs(daysUntil)} jour(s)`, color: "warning" };
        if (hoursUntil < 24) return { text: `RDV dans ${Math.max(1, hoursUntil)} heure(s)`, color: "muted" };
        return { text: `RDV dans ${daysUntil} jour(s)`, color: "muted" };
      }
      return null;
    }
    if (status === "devis_envoye") {
      const sentQuote = quotes.find(q => q.sent_at);
      const ref = sentQuote?.sent_at ? new Date(sentQuote.sent_at) : new Date(dossier.status_changed_at);
      return formatCounter("Envoyé", ref, now);
    }
    if (status === "devis_signe") return formatCounter("Signé", new Date(dossier.status_changed_at), now);
    if (status === "invoice_pending") {
      const inv = invoices[0];
      const ref = inv ? new Date(inv.created_at) : new Date(dossier.status_changed_at);
      const now2 = new Date();
      if (inv?.payment_terms) {
        const termDays = parseInt(inv.payment_terms, 10);
        if (!isNaN(termDays)) {
          const dueDate = new Date(ref);
          dueDate.setDate(dueDate.getDate() + termDays);
          if (now2 > dueDate) {
            const overdueDays = differenceInDays(now2, dueDate);
            return { text: `En retard de ${overdueDays} jour(s)`, color: "destructive" };
          }
        }
      }
      return formatCounter("Émise", ref, now2);
    }
    return null;
  };

  const formatCounter = (prefix: string, ref: Date, now: Date): { text: string; color: "muted" | "warning" | "destructive" } => {
    const hours = differenceInHours(now, ref);
    const days = differenceInDays(now, ref);
    if (hours < 24) return { text: `${prefix} il y a ${Math.max(1, hours)} heure(s)`, color: "muted" };
    if (days <= 7) return { text: `${prefix} il y a ${days} jour(s)`, color: "muted" };
    return { text: `${prefix} il y a ${days} jour(s)`, color: "warning" };
  };

  // ── Build contextual action cards ──
  const getContextualActions = (): { headline: string; subtitle?: string; actions: ActionCard[]; done?: boolean; badge?: string } => {
    const status = dossier.status;

    // ──── DONE STATES ────
    if (status === "invoice_paid") {
      return { headline: "Dossier terminé avec succès !", done: true, badge: "✅ Terminé", actions: [] };
    }
    if (status === "clos_perdu") {
      return { headline: "Ce dossier est classé comme perdu", done: true, badge: "Clos", actions: [] };
    }

    // ──── NOUVEAU / A QUALIFIER — Client info incomplete ────
    if (hasIncompleteInfo && ["nouveau", "a_qualifier"].includes(status)) {
      return {
        headline: "Infos manquantes du client",
        subtitle: `Manque : ${missingFields.join(", ")}. Envoyez le lien pour que le client complète.`,
        actions: [
          {
            id: "send-link",
            label: "Envoyer le lien client",
            description: "Le client remplira ses infos",
            icon: <Link2 className="h-5 w-5" />,
            action: () => sendClientLink.mutate(),
            isPending: sendClientLink.isPending,
            variant: "primary",
            pulse: true,
          },
          {
            id: "call",
            label: "Appeler le client",
            description: "Récupérer les infos par téléphone",
            icon: <Phone className="h-5 w-5" />,
            action: () => { if (dossier.client_phone) window.open(`tel:${dossier.client_phone}`); },
            variant: "secondary",
          },
          {
            id: "rdv",
            label: "Fixer un RDV",
            description: "Planifier directement",
            icon: <Calendar className="h-5 w-5" />,
            action: () => onScrollToAppointment?.(),
            variant: "subtle",
          },
        ],
      };
    }

    // ──── NOUVEAU / A QUALIFIER / DEVIS_A_FAIRE — Infos complètes ────
    if (["nouveau", "a_qualifier", "devis_a_faire"].includes(status)) {
      return {
        headline: "Client prêt — choisissez votre prochaine action",
        subtitle: "Créez un devis ou planifiez l'intervention selon votre façon de travailler.",
        actions: [
          {
            id: "import-devis",
            label: "Importer un devis",
            description: "Charger un PDF existant",
            icon: <FileText className="h-5 w-5" />,
            action: () => window.dispatchEvent(new CustomEvent("open-import-devis")),
            variant: "primary",
          },
          {
            id: "create-devis",
            label: "Créer un devis",
            description: "Éditeur de devis assisté",
            icon: <PenLine className="h-5 w-5" />,
            action: () => navigate(`/devis/new?dossier=${dossier.id}`),
            variant: "primary",
          },
          {
            id: "rdv",
            label: "Proposer un RDV",
            description: "Envoyer des créneaux",
            icon: <Calendar className="h-5 w-5" />,
            action: () => onScrollToAppointment?.(),
            variant: "secondary",
          },
          {
            id: "note",
            label: "Note vocale",
            description: "Dicter une note terrain",
            icon: <Mic className="h-5 w-5" />,
            action: () => window.dispatchEvent(new CustomEvent("open-voice-recorder")),
            variant: "subtle",
          },
        ],
      };
    }

    // ──── DEVIS ENVOYÉ — En attente signature ────
    if (status === "devis_envoye") {
      return {
        headline: "Devis envoyé — en attente de réponse",
        subtitle: "Relancez le client ou planifiez un RDV en attendant la signature.",
        actions: [
          {
            id: "relance",
            label: "Relancer le client",
            description: "Renvoyer le devis par email",
            icon: <RefreshCw className="h-5 w-5" />,
            action: () => {
              if (quotes.length > 0 && quotes[0].status === "envoye") {
                supabase.functions.invoke("send-quote", { body: { quote_id: quotes[0].id } })
                  .then(() => toast({ title: "Devis renvoyé !" }))
                  .catch((e) => toast({ title: "Erreur", description: e.message, variant: "destructive" }));
              }
            },
            variant: "primary",
            pulse: true,
          },
          {
            id: "rdv",
            label: "Proposer un RDV",
            description: "Anticiper l'intervention",
            icon: <Calendar className="h-5 w-5" />,
            action: () => onScrollToAppointment?.(),
            variant: "secondary",
          },
          {
            id: "call",
            label: "Appeler le client",
            description: "Suivi par téléphone",
            icon: <Phone className="h-5 w-5" />,
            action: () => { if (dossier.client_phone) window.open(`tel:${dossier.client_phone}`); },
            variant: "subtle",
          },
        ],
      };
    }

    // ──── DEVIS SIGNÉ — Planifier intervention ────
    if (status === "devis_signe") {
      return {
        headline: "Devis signé ! Planifiez l'intervention",
        subtitle: "Proposez des créneaux au client ou fixez le RDV directement.",
        actions: [
          {
            id: "propose-slots",
            label: "Proposer des créneaux",
            description: "Le client choisit son horaire",
            icon: <Calendar className="h-5 w-5" />,
            action: () => onScrollToAppointment?.(),
            variant: "primary",
            pulse: true,
          },
          {
            id: "manual-rdv",
            label: "Fixer manuellement",
            description: "RDV par téléphone ou accord",
            icon: <CheckCircle2 className="h-5 w-5" />,
            action: () => setShowManualRdv(true),
            variant: "secondary",
          },
          {
            id: "photo",
            label: "Ajouter des photos",
            description: "Préparer le dossier terrain",
            icon: <Camera className="h-5 w-5" />,
            action: () => window.dispatchEvent(new CustomEvent("open-photo-upload")),
            variant: "subtle",
          },
        ],
      };
    }

    // ──── EN ATTENTE RDV ────
    if (status === "en_attente_rdv") {
      return {
        headline: "En attente — fixez un rendez-vous",
        subtitle: "Proposez des créneaux ou fixez le RDV directement.",
        actions: [
          {
            id: "propose-slots",
            label: "Proposer des créneaux",
            description: "Le client choisit son horaire",
            icon: <Calendar className="h-5 w-5" />,
            action: () => onScrollToAppointment?.(),
            variant: "primary",
            pulse: true,
          },
          {
            id: "manual-rdv",
            label: "Fixer manuellement",
            description: "Accord verbal ou téléphone",
            icon: <CheckCircle2 className="h-5 w-5" />,
            action: () => setShowManualRdv(true),
            variant: "secondary",
          },
          {
            id: "call",
            label: "Appeler le client",
            description: "Convenir d'un horaire",
            icon: <Phone className="h-5 w-5" />,
            action: () => { if (dossier.client_phone) window.open(`tel:${dossier.client_phone}`); },
            variant: "subtle",
          },
        ],
      };
    }

    // ──── RDV PRIS — Intervention à venir ────
    if (status === "rdv_pris") {
      const appointmentDate = (dossier as any).appointment_date;
      const timeStart = (dossier as any).appointment_time_start;
      const timeEnd = (dossier as any).appointment_time_end;
      const dateInfo = appointmentDate ? format(new Date(appointmentDate), "EEEE d MMMM", { locale: fr }) : "";
      const timeInfo = timeStart && timeEnd ? ` de ${timeStart.slice(0, 5)} à ${timeEnd.slice(0, 5)}` : "";

      return {
        headline: `Intervention ${dateInfo}${timeInfo}`,
        subtitle: "Marquez comme terminée après l'intervention.",
        actions: [
          {
            id: "mark-done",
            label: "Intervention terminée",
            description: "Passer à la facturation",
            icon: <CheckCircle2 className="h-5 w-5" />,
            action: () => markDone.mutate(),
            isPending: markDone.isPending,
            variant: "primary",
          },
          {
            id: "photo",
            label: "Photos chantier",
            description: "Documenter le travail",
            icon: <Camera className="h-5 w-5" />,
            action: () => window.dispatchEvent(new CustomEvent("open-photo-upload")),
            variant: "secondary",
          },
          {
            id: "note",
            label: "Note vocale",
            description: "Compte rendu rapide",
            icon: <Mic className="h-5 w-5" />,
            action: () => window.dispatchEvent(new CustomEvent("open-voice-recorder")),
            variant: "subtle",
          },
        ],
      };
    }

    // ──── RDV TERMINÉ — Facturer ────
    if (status === "rdv_termine") {
      return {
        headline: "Intervention terminée — facturation",
        subtitle: "Importez ou créez la facture pour finaliser.",
        actions: [
          {
            id: "import-facture",
            label: "Importer facture",
            description: "Charger un PDF existant",
            icon: <Receipt className="h-5 w-5" />,
            action: () => window.dispatchEvent(new CustomEvent("open-import-facture")),
            variant: "primary",
            pulse: true,
          },
          {
            id: "create-facture",
            label: "Créer une facture",
            description: "Éditeur de facture",
            icon: <PenLine className="h-5 w-5" />,
            action: () => navigate(`/facture/new?dossier=${dossier.id}`),
            variant: "primary",
          },
          {
            id: "photo",
            label: "Photos finales",
            description: "Preuves du travail réalisé",
            icon: <Camera className="h-5 w-5" />,
            action: () => window.dispatchEvent(new CustomEvent("open-photo-upload")),
            variant: "subtle",
          },
        ],
      };
    }

    // ──── FACTURE EN ATTENTE ────
    if (status === "invoice_pending") {
      const inv = invoices[0];
      return {
        headline: inv ? `Facture ${inv.invoice_number} — en attente de paiement` : "Facture en attente de paiement",
        subtitle: "Marquez comme payée dès réception du règlement.",
        actions: [
          {
            id: "mark-paid",
            label: "Marquer payée",
            description: "Le client a réglé",
            icon: <CreditCard className="h-5 w-5" />,
            action: () => markPaid.mutate(),
            isPending: markPaid.isPending,
            variant: "primary",
          },
          {
            id: "relance",
            label: "Relancer le paiement",
            description: "Envoyer un rappel",
            icon: <Send className="h-5 w-5" />,
            action: () => {
              supabase.functions.invoke("send-relance", {
                body: { dossier_id: dossier.id, type: "invoice_pending" },
              })
                .then(() => toast({ title: "Relance envoyée !" }))
                .catch((e) => toast({ title: "Erreur", description: e.message, variant: "destructive" }));
            },
            variant: "secondary",
          },
          {
            id: "call",
            label: "Appeler le client",
            description: "Suivi de paiement",
            icon: <Phone className="h-5 w-5" />,
            action: () => { if (dossier.client_phone) window.open(`tel:${dossier.client_phone}`); },
            variant: "subtle",
          },
        ],
      };
    }

    return { headline: "", actions: [] };
  };

  const { headline, subtitle, actions, done, badge } = getContextualActions();
  const timeCounter = getTimeCounter();
  if (!headline) return null;

  const counterColorClass = timeCounter?.color === "destructive"
    ? "text-destructive"
    : timeCounter?.color === "warning"
      ? "text-warning"
      : "text-muted-foreground";

  const variantStyles = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md border-0",
    secondary: "bg-card text-foreground hover:bg-accent border border-border shadow-sm",
    subtle: "bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/[0.02] p-4 space-y-3"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="space-y-1"
      >
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.15, 1] }}
            transition={{ duration: 1.5, delay: 0.5, ease: "easeInOut" }}
          >
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
          </motion.div>
          <p className="text-sm font-semibold text-foreground">{headline}</p>
        </div>
        {timeCounter && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className={`text-[11px] flex items-center gap-1 ml-6 ${counterColorClass}`}
          >
            <Clock className="h-3 w-3" />
            {timeCounter.text}
          </motion.p>
        )}
        {subtitle && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-start gap-2 mt-1 ml-6"
          >
            <AlertCircle className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">{subtitle}</p>
          </motion.div>
        )}
      </motion.div>

      {/* Done state */}
      {done && badge && (
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 300 }}>
          <Badge className="bg-success/15 text-success text-sm px-3 py-1">{badge}</Badge>
        </motion.div>
      )}

      {/* Action cards grid */}
      {actions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.3 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-2"
        >
          {actions.map((card, i) => (
            <motion.button
              key={card.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.08, duration: 0.25 }}
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={card.action}
              disabled={card.isPending}
              className={`
                relative flex items-center gap-3 rounded-lg px-3.5 py-3 text-left transition-all
                ${variantStyles[card.variant]}
                ${card.isPending ? "opacity-60 cursor-wait" : "cursor-pointer"}
                ${card.variant === "primary" && actions.filter(a => a.variant === "primary").length === 1 ? "sm:col-span-2" : ""}
              `}
            >
              {/* Pulse ring for priority actions */}
              {card.pulse && !card.isPending && (
                <motion.span
                  className="absolute inset-0 rounded-lg border-2 border-primary/40"
                  animate={{ opacity: [0.6, 0, 0.6], scale: [1, 1.02, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}

              <span className={`shrink-0 ${card.variant === "primary" ? "text-primary-foreground" : card.variant === "secondary" ? "text-primary" : "text-muted-foreground"}`}>
                {card.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : card.icon}
              </span>
              <div className="min-w-0 flex-1">
                <span className={`block text-sm font-medium leading-tight ${card.variant === "primary" ? "text-primary-foreground" : "text-foreground"}`}>
                  {card.label}
                </span>
                <span className={`block text-[11px] leading-tight mt-0.5 ${card.variant === "primary" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {card.description}
                </span>
              </div>
              {card.variant === "primary" && (
                <motion.div
                  animate={{ x: [0, 3, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 2 }}
                  className="shrink-0"
                >
                  <ArrowRight className="h-4 w-4" />
                </motion.div>
              )}
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* Manual RDV inline form */}
      <AnimatePresence>
        {showManualRdv && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border border-border rounded-lg p-3 space-y-3 bg-background overflow-hidden"
          >
            <p className="text-xs font-medium text-foreground">Fixer un rendez-vous</p>
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-[10px]">Date</Label>
                <Input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="w-20 space-y-1">
                <Label className="text-[10px]">Début</Label>
                <Input type="time" value={manualStart} onChange={(e) => setManualStart(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="w-20 space-y-1">
                <Label className="text-[10px]">Fin</Label>
                <Input type="time" value={manualEnd} onChange={(e) => setManualEnd(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setManualRdv.mutate()} disabled={setManualRdv.isPending}>
                {setManualRdv.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirmer le RDV"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowManualRdv(false)}>Annuler</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
