import type { Database } from "@/integrations/supabase/types";

type DossierStatus = Database["public"]["Enums"]["dossier_status"];
type DossierSource = Database["public"]["Enums"]["dossier_source"];
type ProblemCategory = Database["public"]["Enums"]["problem_category"];
type UrgencyLevel = Database["public"]["Enums"]["urgency_level"];

export const STATUS_LABELS: Record<DossierStatus, string> = {
  nouveau: "Nouveau",
  a_qualifier: "Nouveau",
  devis_a_faire: "Devis à faire",
  devis_envoye: "Devis envoyé",
  devis_signe: "Devis signé",
  clos_signe: "Devis signé", // legacy alias
  en_attente_rdv: "En attente de RDV",
  rdv_pris: "RDV pris",
  rdv_termine: "RDV terminé",
  clos_perdu: "Clos (perdu)",
  invoice_pending: "Facture en attente",
  invoice_paid: "Facture payée",
};

export const STATUS_COLORS: Record<DossierStatus, string> = {
  nouveau: "bg-primary/15 text-primary",
  a_qualifier: "bg-primary/15 text-primary",
  devis_a_faire: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  devis_envoye: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  devis_signe: "bg-success/15 text-success",
  clos_signe: "bg-success/15 text-success",
  en_attente_rdv: "bg-warning/15 text-warning",
  rdv_pris: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  rdv_termine: "bg-primary/15 text-primary",
  clos_perdu: "bg-muted text-muted-foreground",
  invoice_pending: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  invoice_paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

/** Statuses displayed on the dashboard (ordered) */
export const DASHBOARD_STATUSES: DossierStatus[] = [
  "nouveau",
  "en_attente_rdv",
  "rdv_pris",
  "rdv_termine",
  "devis_a_faire",
  "devis_envoye",
  "devis_signe",
  "invoice_pending",
  "invoice_paid",
  "clos_perdu",
];

/** All valid statuses for the status select dropdown */
export const ALL_STATUSES: DossierStatus[] = [
  "nouveau",
  "en_attente_rdv",
  "rdv_pris",
  "rdv_termine",
  "devis_a_faire",
  "devis_envoye",
  "devis_signe",
  "invoice_pending",
  "invoice_paid",
  "clos_perdu",
];

export const SOURCE_LABELS: Record<DossierSource, string> = {
  lien_client: "Lien client",
  manuel: "Manuel",
  email: "Email",
  public_link: "Lien public",
};

export const CATEGORY_LABELS: Record<ProblemCategory, string> = {
  wc: "WC",
  fuite: "Fuite",
  chauffe_eau: "Chauffe-eau",
  evier: "Évier",
  douche: "Douche",
  autre: "Autre",
};

export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  aujourdhui: "Aujourd'hui",
  "48h": "48h",
  semaine: "Semaine",
};

export const URGENCY_COLORS: Record<UrgencyLevel, string> = {
  aujourdhui: "bg-destructive/15 text-destructive",
  "48h": "bg-warning/15 text-warning",
  semaine: "bg-muted text-muted-foreground",
};

// Urgency sort order (higher = more urgent)
export const URGENCY_ORDER: Record<UrgencyLevel, number> = {
  aujourdhui: 3,
  "48h": 2,
  semaine: 1,
};

// Appointment status labels & colors
export type AppointmentStatus = "none" | "rdv_pending" | "slots_proposed" | "client_selected" | "rdv_confirmed" | "cancelled" | "done";

/** Simplified appointment tile keys for dashboard */
export type AppointmentTileKey = "slots_needed" | "waiting_client" | "rdv_confirmed" | "rdv_done";

/** Map DB appointment_status values to dashboard tile keys */
export function toAppointmentTileKey(status: AppointmentStatus): AppointmentTileKey | null {
  switch (status) {
    case "rdv_pending": return "slots_needed";
    case "slots_proposed":
    case "client_selected": return "waiting_client";
    case "rdv_confirmed": return "rdv_confirmed";
    case "done": return "rdv_done";
    default: return null;
  }
}

export const APPOINTMENT_TILE_LABELS: Record<AppointmentTileKey, string> = {
  slots_needed: "Créneaux à proposer",
  waiting_client: "En attente client",
  rdv_confirmed: "RDV pris",
  rdv_done: "RDV terminé",
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  none: "Aucun",
  rdv_pending: "Créneaux à proposer",
  slots_proposed: "En attente client",
  client_selected: "En attente client",
  rdv_confirmed: "RDV pris",
  done: "RDV terminé",
  cancelled: "Annulé",
};

export const APPOINTMENT_STATUS_COLORS: Record<AppointmentStatus, string> = {
  none: "bg-muted text-muted-foreground",
  rdv_pending: "bg-warning/15 text-warning",
  slots_proposed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  client_selected: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  rdv_confirmed: "bg-success/15 text-success",
  done: "bg-primary/15 text-primary",
  cancelled: "bg-destructive/15 text-destructive",
};

// Google Maps API Key (publishable, restricted by HTTP referrer)
export const GOOGLE_MAPS_API_KEY = "";
