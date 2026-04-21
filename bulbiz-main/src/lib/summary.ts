import type { Dossier } from "@/hooks/useDossier";
import { CATEGORY_LABELS, URGENCY_LABELS } from "@/lib/constants";

export function generateStructuredSummary(dossier: Dossier): { headline: string; bullets: string[] } {
  const category = CATEGORY_LABELS[dossier.category];
  const urgency = URGENCY_LABELS[dossier.urgency];
  
  const headline = `Demande : ${category.toLowerCase()} – urgence ${urgency.toLowerCase()}`;

  const bullets: string[] = [];

  if (dossier.address) {
    bullets.push(dossier.address);
  }

  if (dossier.description) {
    // Take first 2 sentences or 120 chars
    const desc = dossier.description.length > 120
      ? dossier.description.substring(0, 120) + "…"
      : dossier.description;
    bullets.push(desc);
  }

  bullets.push(`Catégorie : ${category}`);
  bullets.push(`Urgence : ${urgency}`);

  if (dossier.client_email) {
    bullets.push("Email client renseigné");
  }

  return { headline, bullets: bullets.slice(0, 5) };
}
