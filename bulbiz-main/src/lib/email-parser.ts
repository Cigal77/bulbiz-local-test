import type { DossierFormData } from "@/lib/dossier-schema";

/**
 * Parse raw email text and extract dossier fields.
 * Uses pattern matching – not AI. Fast and deterministic.
 */
export function parseEmailContent(raw: string): Partial<DossierFormData> {
  const result: Partial<DossierFormData> = {};
  const text = raw.trim();

  // Phone: French formats
  const phoneMatch = text.match(/(?:0[1-9][\s.\-]?(?:\d{2}[\s.\-]?){4}|\+33[\s.\-]?\d[\s.\-]?(?:\d{2}[\s.\-]?){4})/);
  if (phoneMatch) result.client_phone = phoneMatch[0].replace(/[\s.\-]/g, "");

  // Email
  const emailMatch = text.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) result.client_email = emailMatch[0];

  // Name extraction: look for common patterns
  const namePatterns = [
    /(?:M\.|Mme|Mr|Monsieur|Madame)\s+([A-ZÀ-Ü][a-zà-ü]+)\s+([A-ZÀ-Ü][A-ZÀ-Üa-zà-ü]+)/,
    /(?:Nom|Client|Demandeur)\s*:\s*([A-ZÀ-Ü][a-zà-ü]+)\s+([A-ZÀ-Ü][A-ZÀ-Üa-zà-ü]+)/i,
    /(?:Prénom|Prenom)\s*:\s*([A-ZÀ-Ü][a-zà-ü]+)[\s\S]*?(?:Nom)\s*:\s*([A-ZÀ-Ü][A-ZÀ-Üa-zà-ü]+)/i,
  ];
  for (const pat of namePatterns) {
    const m = text.match(pat);
    if (m) {
      result.client_first_name = m[1];
      result.client_last_name = m[2];
      break;
    }
  }

  // Address: look for patterns with postal codes
  const addrMatch = text.match(/\d{1,4}[\s,]+(?:rue|avenue|boulevard|av\.|bd|impasse|allée|chemin|place|cours|passage)[\s\S]{5,80}?\d{5}\s+[A-ZÀ-Üa-zà-ü\s-]+/i);
  if (addrMatch) result.address = addrMatch[0].trim();

  // Category detection
  const lowerText = text.toLowerCase();
  const categoryKeywords: Record<string, string[]> = {
    wc: ["wc", "toilette", "toilettes", "chasse d'eau"],
    fuite: ["fuite", "fuit", "coule", "dégât des eaux", "degat des eaux", "inondation"],
    chauffe_eau: ["chauffe-eau", "chauffe eau", "ballon", "cumulus", "eau chaude"],
    evier: ["évier", "evier", "robinet cuisine", "siphon"],
    douche: ["douche", "baignoire", "bac à douche", "colonne de douche"],
  };

  for (const [cat, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((kw) => lowerText.includes(kw))) {
      result.category = cat as DossierFormData["category"];
      break;
    }
  }

  // Urgency detection
  if (/urgent|immédiat|aujourd.?hui|tout de suite|en urgence/i.test(text)) {
    result.urgency = "aujourdhui";
  } else if (/48\s?h|sous\s+2\s+jours|rapidement/i.test(text)) {
    result.urgency = "48h";
  }

  // Description: use the full text as description if nothing else
  if (text.length > 10) {
    result.description = text.substring(0, 5000);
  }

  return result;
}
