import type { Dossier } from "@/hooks/useDossier";

const CATEGORY_LABELS: Record<string, string> = {
  wc: "WC / Toilettes",
  fuite: "Fuite",
  chauffe_eau: "Chauffe-eau",
  evier: "Évier",
  douche: "Douche / Baignoire",
  autre: "Autre",
};

const URGENCY_LABELS: Record<string, string> = {
  aujourdhui: "Aujourd'hui",
  "48h": "Sous 48h",
  semaine: "Dans la semaine",
};

/**
 * Build a rich, well-structured description for a Google Calendar event
 * containing all available client and dossier information.
 */
export function buildCalendarDescription(dossier: Dossier): string {
  const clientName = [dossier.client_first_name, dossier.client_last_name].filter(Boolean).join(" ");

  const sections: string[] = [];

  // ── Client ──
  const clientLines: string[] = [];
  if (clientName) clientLines.push(`👤 Client : ${clientName}`);
  if (dossier.client_phone) clientLines.push(`📞 Tél : ${dossier.client_phone}`);
  if (dossier.client_email) clientLines.push(`📧 Email : ${dossier.client_email}`);
  if (clientLines.length) sections.push(clientLines.join("\n"));

  // ── Adresse ──
  const addressLines: string[] = [];
  const fullAddress = dossier.address || [dossier.address_line, dossier.postal_code, dossier.city].filter(Boolean).join(", ");
  if (fullAddress) addressLines.push(`📍 Adresse : ${fullAddress}`);
  if (dossier.floor_number != null) addressLines.push(`🏢 Étage : ${dossier.floor_number}${dossier.has_elevator ? " (ascenseur)" : " (sans ascenseur)"}`);
  if (dossier.access_code) addressLines.push(`🔑 Code d'accès : ${dossier.access_code}`);
  if (dossier.housing_type) addressLines.push(`🏠 Logement : ${dossier.housing_type}`);
  if (dossier.occupant_type) addressLines.push(`👥 Occupant : ${dossier.occupant_type}`);
  if (addressLines.length) sections.push(addressLines.join("\n"));

  // ── Intervention ──
  const interventionLines: string[] = [];
  const categoryLabel = CATEGORY_LABELS[dossier.category] || dossier.category;
  interventionLines.push(`🔧 Catégorie : ${categoryLabel}`);
  if (dossier.problem_types?.length) interventionLines.push(`⚠️ Problèmes : ${dossier.problem_types.join(", ")}`);
  if (dossier.urgency) interventionLines.push(`⏰ Urgence : ${URGENCY_LABELS[dossier.urgency] || dossier.urgency}`);
  if (dossier.description) interventionLines.push(`📝 Description : ${dossier.description}`);
  if (dossier.appointment_notes) interventionLines.push(`💬 Notes RDV : ${dossier.appointment_notes}`);
  if (interventionLines.length) sections.push(interventionLines.join("\n"));

  // ── Lien dossier ──
  const appUrl = typeof window !== "undefined" ? window.location.origin : "https://bulbiz.lovable.app";
  sections.push(`🔗 Dossier : ${appUrl}/dossier/${dossier.id}`);

  return sections.join("\n\n");
}

/**
 * Build the full event summary line.
 */
export function buildCalendarSummary(dossier: Dossier): string {
  const clientName = [dossier.client_first_name, dossier.client_last_name].filter(Boolean).join(" ");
  const categoryLabel = CATEGORY_LABELS[dossier.category] || dossier.category;
  return `RDV${clientName ? ` – ${clientName}` : ""}${categoryLabel ? ` (${categoryLabel})` : ""}`;
}
