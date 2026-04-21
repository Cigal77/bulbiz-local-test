import { useMemo, useState } from "react";
import type { Historique } from "@/hooks/useDossier";
import { formatDistanceToNow, format, differenceInMinutes } from "date-fns";
import { fr } from "date-fns/locale";
import {
  FolderPlus, Send, FileText, Bell, ArrowRightLeft,
  FilePenLine, FileCheck, FileX, Download, Trash2, UserCheck, Link2, Smartphone,
  ChevronDown, ChevronUp, MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

// ── Mapping tech → humain ──────────────────────────────────────────

interface DisplayEntry {
  id: string;
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  detail: string | null;
  timestamp: Date;
}

function mapEntry(entry: Historique): DisplayEntry {
  const ts = new Date(entry.created_at);
  const action = entry.action;
  const details = entry.details ?? "";

  // Devis
  if (action === "quote_created") {
    return {
      id: entry.id, timestamp: ts,
      icon: <FilePenLine className="h-3.5 w-3.5" />,
      iconColor: "bg-primary/15 text-primary",
      title: "Devis créé",
      detail: details || null,
    };
  }
  if (action === "quote_deleted") {
    return {
      id: entry.id, timestamp: ts,
      icon: <Trash2 className="h-3.5 w-3.5" />,
      iconColor: "bg-destructive/15 text-destructive",
      title: "Devis supprimé",
      detail: details || null,
    };
  }
  if (action === "quote_pdf_generated") {
    return {
      id: entry.id, timestamp: ts,
      icon: <FileText className="h-3.5 w-3.5" />,
      iconColor: "bg-primary/15 text-primary",
      title: "PDF du devis généré",
      detail: details || null,
    };
  }
  if (action === "quote_sent") {
    return {
      id: entry.id, timestamp: ts,
      icon: <Send className="h-3.5 w-3.5" />,
      iconColor: "bg-success/15 text-success",
      title: "Devis envoyé au client",
      detail: details || null,
    };
  }
  if (action === "quote_imported") {
    return {
      id: entry.id, timestamp: ts,
      icon: <Download className="h-3.5 w-3.5" />,
      iconColor: "bg-primary/15 text-primary",
      title: "Devis importé (PDF)",
      detail: details || null,
    };
  }
  if (action === "quote_status_change") {
    let statusLabel = details;
    if (details.includes("Envoyé")) statusLabel = "Statut du devis : Envoyé";
    else if (details.includes("Signé")) statusLabel = "Statut du devis : Signé";
    else if (details.includes("Refusé")) statusLabel = "Statut du devis : Refusé";
    else if (details.includes("Brouillon")) statusLabel = "Statut du devis : Brouillon";
    else statusLabel = "Statut du devis mis à jour";
    return {
      id: entry.id, timestamp: ts,
      icon: <FileCheck className="h-3.5 w-3.5" />,
      iconColor: details.includes("Signé") ? "bg-success/15 text-success"
        : details.includes("Refusé") ? "bg-destructive/15 text-destructive"
        : "bg-primary/15 text-primary",
      title: statusLabel,
      detail: null,
    };
  }

  // Quote validated/refused by client
  if (action === "quote_validated_by_client") {
    return {
      id: entry.id, timestamp: ts,
      icon: <FileCheck className="h-3.5 w-3.5" />,
      iconColor: "bg-success/15 text-success",
      title: "Devis validé par le client",
      detail: details || null,
    };
  }
  if (action === "quote_refused_by_client") {
    return {
      id: entry.id, timestamp: ts,
      icon: <FileX className="h-3.5 w-3.5" />,
      iconColor: "bg-destructive/15 text-destructive",
      title: "Devis refusé par le client",
      detail: details || null,
    };
  }
  if (action === "quote_link_viewed") {
    return {
      id: entry.id, timestamp: ts,
      icon: <FileText className="h-3.5 w-3.5" />,
      iconColor: "bg-muted text-muted-foreground",
      title: "Lien de validation consulté",
      detail: details || null,
    };
  }

  // Client link sent
  if (action === "client_link_sent_email") {
    const emailMatch = details.match(/[\w.-]+@[\w.-]+/);
    return {
      id: entry.id, timestamp: ts,
      icon: <Send className="h-3.5 w-3.5" />,
      iconColor: "bg-primary/15 text-primary",
      title: "Lien client envoyé par email",
      detail: emailMatch ? `Envoyé à ${emailMatch[0]}` : details || null,
    };
  }
  if (action === "client_link_sent_sms") {
    const phoneMatch = details.match(/[\d\s+]+/);
    return {
      id: entry.id, timestamp: ts,
      icon: <Smartphone className="h-3.5 w-3.5" />,
      iconColor: "bg-primary/15 text-primary",
      title: "Lien client envoyé par SMS",
      detail: phoneMatch ? `Envoyé au ${phoneMatch[0].trim()}` : details || null,
    };
  }
  if (action === "client_link_not_sent") {
    return {
      id: entry.id, timestamp: ts,
      icon: <Bell className="h-3.5 w-3.5" />,
      iconColor: "bg-warning/15 text-warning",
      title: "Coordonnées manquantes",
      detail: "Lien client non envoyé",
    };
  }

  // Relances
  if (action === "relance_sent" || action === "reminder_sent") {
    const isDevis = details.toLowerCase().includes("devis");
    const relanceType = isDevis ? "Devis non signé" : "Informations manquantes";
    const emailMatch = details.match(/[\w.-]+@[\w.-]+/);
    return {
      id: entry.id, timestamp: ts,
      icon: <Bell className="h-3.5 w-3.5" />,
      iconColor: "bg-warning/15 text-warning",
      title: `Relance envoyée – ${relanceType}`,
      detail: emailMatch ? `Envoyée par email à ${emailMatch[0]}` : details || null,
    };
  }
  if (action === "relance_sent_sms") {
    const isDevis = details.toLowerCase().includes("devis");
    const relanceType = isDevis ? "Devis non signé" : "Informations manquantes";
    return {
      id: entry.id, timestamp: ts,
      icon: <Smartphone className="h-3.5 w-3.5" />,
      iconColor: "bg-warning/15 text-warning",
      title: `Relance envoyée par SMS – ${relanceType}`,
      detail: details || null,
    };
  }
  if (action === "quote_sent_sms") {
    return {
      id: entry.id, timestamp: ts,
      icon: <Smartphone className="h-3.5 w-3.5" />,
      iconColor: "bg-success/15 text-success",
      title: "Devis envoyé par SMS",
      detail: details || null,
    };
  }
  if (action === "sms_error") {
    return {
      id: entry.id, timestamp: ts,
      icon: <Smartphone className="h-3.5 w-3.5" />,
      iconColor: "bg-destructive/15 text-destructive",
      title: "SMS non envoyé (erreur)",
      detail: details || null,
    };
  }

  // Client / Dossier
  if (action === "dossier_created" || action === "created") {
    return {
      id: entry.id, timestamp: ts,
      icon: <FolderPlus className="h-3.5 w-3.5" />,
      iconColor: "bg-primary/15 text-primary",
      title: "Dossier créé",
      detail: details || "Création manuelle",
    };
  }
  if (action === "client_link_generated" || action === "link_sent") {
    return {
      id: entry.id, timestamp: ts,
      icon: <Link2 className="h-3.5 w-3.5" />,
      iconColor: "bg-primary/15 text-primary",
      title: "Lien client envoyé",
      detail: details || null,
    };
  }
  if (action === "client_form_submitted" || action === "form_completed") {
    return {
      id: entry.id, timestamp: ts,
      icon: <UserCheck className="h-3.5 w-3.5" />,
      iconColor: "bg-success/15 text-success",
      title: "Le client a complété sa demande",
      detail: details || null,
    };
  }

  // Statuts dossier
  if (action === "status_change") {
    let label = "Statut du dossier mis à jour";
    if (details.includes("a_qualifier") || details.includes("qualifier")) label = "Statut du dossier : À qualifier";
    else if (details.includes("devis_a_faire")) label = "Statut du dossier : Devis à faire";
    else if (details.includes("devis_envoye") || details.includes("envoyé")) label = "Statut du dossier : Devis envoyé";
    else if (details.includes("clos_signe") || details.includes("signé")) label = "Statut du dossier : Clos – Signé";
    else if (details.includes("clos_perdu") || details.includes("perdu")) label = "Statut du dossier : Clos – Perdu";
    else if (details.includes("nouveau")) label = "Statut du dossier : Nouveau";
    return {
      id: entry.id, timestamp: ts,
      icon: <ArrowRightLeft className="h-3.5 w-3.5" />,
      iconColor: "bg-muted text-muted-foreground",
      title: label,
      detail: null,
    };
  }

  // Médias
  if (action === "media_added") {
    return {
      id: entry.id, timestamp: ts,
      icon: <FileText className="h-3.5 w-3.5" />,
      iconColor: "bg-muted text-muted-foreground",
      title: "Média ajouté",
      detail: details || null,
    };
  }

  // Relance toggle
  if (action === "relance_toggle") {
    return {
      id: entry.id, timestamp: ts,
      icon: <Bell className="h-3.5 w-3.5" />,
      iconColor: "bg-muted text-muted-foreground",
      title: details.includes("désactivé") ? "Relances automatiques désactivées" : "Relances automatiques activées",
      detail: null,
    };
  }

  // Dossier delete/restore
  if (action === "dossier_deleted") {
    return {
      id: entry.id, timestamp: ts,
      icon: <Trash2 className="h-3.5 w-3.5" />,
      iconColor: "bg-destructive/15 text-destructive",
      title: "Dossier supprimé (corbeille)",
      detail: details || null,
    };
  }
  if (action === "dossier_restored") {
    return {
      id: entry.id, timestamp: ts,
      icon: <FolderPlus className="h-3.5 w-3.5" />,
      iconColor: "bg-success/15 text-success",
      title: "Dossier restauré",
      detail: details || null,
    };
  }

  // Notes (text notes added by artisan)
  if (action === "note") {
    return {
      id: entry.id, timestamp: ts,
      icon: <MessageSquare className="h-3.5 w-3.5" />,
      iconColor: "bg-primary/15 text-primary",
      title: "Note",
      detail: details || null,
    };
  }

  // Invoice
  if (action === "invoice_sent") {
    return {
      id: entry.id, timestamp: ts,
      icon: <Send className="h-3.5 w-3.5" />,
      iconColor: "bg-success/15 text-success",
      title: "Facture envoyée",
      detail: details || null,
    };
  }
  if (action === "invoice_sent_sms") {
    return {
      id: entry.id, timestamp: ts,
      icon: <Smartphone className="h-3.5 w-3.5" />,
      iconColor: "bg-success/15 text-success",
      title: "Facture envoyée par SMS",
      detail: details || null,
    };
  }

  // Notification sent
  if (action === "notification_sent") {
    return {
      id: entry.id, timestamp: ts,
      icon: <Send className="h-3.5 w-3.5" />,
      iconColor: "bg-primary/15 text-primary",
      title: "Notification envoyée",
      detail: details || null,
    };
  }

  // Appointment
  if (action === "appointment_status_change") {
    return {
      id: entry.id, timestamp: ts,
      icon: <ArrowRightLeft className="h-3.5 w-3.5" />,
      iconColor: "bg-muted text-muted-foreground",
      title: "Statut rendez-vous mis à jour",
      detail: details || null,
    };
  }

  // Fallback: display action as-is but clean it up
  return {
    id: entry.id, timestamp: ts,
    icon: <FileText className="h-3.5 w-3.5" />,
    iconColor: "bg-muted text-muted-foreground",
    title: action.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase()),
    detail: details || null,
  };
}

// ── Deduplication: remove duplicate actions within 2 minutes ──

function deduplicateEntries(entries: DisplayEntry[]): DisplayEntry[] {
  const result: DisplayEntry[] = [];
  for (const entry of entries) {
    const isDuplicate = result.some(
      r => r.title === entry.title &&
        Math.abs(differenceInMinutes(r.timestamp, entry.timestamp)) < 2
    );
    if (!isDuplicate) {
      result.push(entry);
    }
  }
  return result;
}

// ── Component ──

interface HistoriqueTimelineProps {
  historique: Historique[];
  isLoading: boolean;
}

export function HistoriqueTimeline({ historique, isLoading }: HistoriqueTimelineProps) {
  const isMobile = useIsMobile();
  const defaultCount = isMobile ? 2 : 3;
  const [expanded, setExpanded] = useState(false);

  const displayEntries = useMemo(() => {
    const mapped = historique.map(mapEntry);
    return deduplicateEntries(mapped);
  }, [historique]);

  const visibleEntries = expanded ? displayEntries : displayEntries.slice(0, defaultCount);
  const hiddenCount = displayEntries.length - defaultCount;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Historique</h3>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Historique</h3>
      {displayEntries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune activité enregistrée.</p>
      ) : (
        <>
          <div className="space-y-0">
            {visibleEntries.map((entry, idx) => (
              <div key={entry.id} className="flex gap-2.5 relative">
                {idx < visibleEntries.length - 1 && (
                  <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />
                )}
                <div className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full shrink-0 z-10",
                  entry.iconColor
                )}>
                  {entry.icon}
                </div>
                <div className="pb-3.5 min-w-0">
                  <p className="text-[13px] font-medium text-foreground leading-tight">
                    {entry.title}
                  </p>
                  {entry.detail && (
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug truncate">
                      {entry.detail}
                    </p>
                  )}
                  <p
                    className="text-[10px] text-muted-foreground/60 mt-0.5"
                    title={format(entry.timestamp, "PPPp", { locale: fr })}
                  >
                    {formatDistanceToNow(entry.timestamp, { addSuffix: true, locale: fr })}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {hiddenCount > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors pt-1"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Voir moins
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Voir + ({hiddenCount} événement{hiddenCount > 1 ? "s" : ""})
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}
